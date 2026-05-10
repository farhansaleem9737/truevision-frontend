// truevision/screens/PexelsReelsScreen.js
//
// Vertical reels feed powered by the Pexels Video API.
// Features: 20-per-page popular feed, debounced search, infinite scroll,
// pull-to-refresh, vertical-first sort, autoplay only the visible card.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, RefreshControl,
  StyleSheet, Dimensions, ActivityIndicator, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused }      from '@react-navigation/native';
import { Ionicons }          from '@expo/vector-icons';
import PexelsReelCard        from '../components/reel/PexelsReelCard';
import pexelsService         from '../services/pexelsService';

const { height: SCREEN_H } = Dimensions.get('window');
const TAB_BAR_OFFSET = 60;          // approximate bottom-tab height (used by reel layout)
const SEARCH_DEBOUNCE_MS = 500;

export default function PexelsReelsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [items, setItems]             = useState([]);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(false);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);
  const searchTimer = useRef(null);

  // ── Fetcher ─────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (p, query) => {
    return query ? pexelsService.search(query, p) : pexelsService.getPopular(p);
  }, []);

  // ── Initial / query change → reload page 1 ──────────────────────────────
  const reload = useCallback(async (query, isPullRefresh = false) => {
    if (isPullRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const res = await fetchPage(1, query);
    if (res.success) {
      setItems(res.items);
      setHasMore(res.hasMore);
      setPage(1);
      setActiveIndex(0);
      flatListRef.current?.scrollToOffset?.({ offset: 0, animated: false });
    } else {
      setError(res.error || 'Failed to load');
      setItems([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [fetchPage]);

  // First mount → popular
  useEffect(() => { reload(''); }, [reload]);

  // ── Search input → debounced ────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const q = searchInput.trim();
      if (q !== activeQuery) {
        setActiveQuery(q);
        reload(q);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(searchTimer.current);
  }, [searchInput, activeQuery, reload]);

  // ── Infinite scroll ─────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const res = await fetchPage(nextPage, activeQuery);
    if (res.success) {
      setItems((prev) => {
        const existing = new Set(prev.map((p) => p.id));
        const merged = res.items.filter((it) => !existing.has(it.id));
        return [...prev, ...merged];
      });
      setHasMore(res.hasMore);
      setPage(nextPage);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, activeQuery, fetchPage]);

  // ── Track which card is on screen → drives autoplay ────────────────────
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems?.length) {
      const top = viewableItems[0];
      if (top?.index != null) setActiveIndex(top.index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  // ── Render helpers ─────────────────────────────────────────────────────
  const renderItem = useCallback(({ item, index }) => (
    <PexelsReelCard
      item={item}
      isActive={index === activeIndex}
      isFocused={isFocused}
      bottomOffset={TAB_BAR_OFFSET + insets.bottom}
    />
  ), [activeIndex, isFocused, insets.bottom]);

  const keyExtractor = useCallback((item) => item.id, []);

  const getItemLayout = useCallback((_, index) => ({
    length: SCREEN_H,
    offset: SCREEN_H * index,
    index,
  }), []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Search header (overlay) ──────────────────────────────────────── */}
      <View style={[S.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>

        <View style={S.searchWrap}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.7)" style={{ marginLeft: 12 }} />
          <TextInput
            style={S.searchInput}
            placeholder="Search Pexels videos..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={searchInput}
            onChangeText={setSearchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => setSearchInput('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.7)" style={{ marginRight: 12 }} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : error && !items.length ? (
        <View style={S.center}>
          <Ionicons name="cloud-offline-outline" size={48} color="rgba(255,255,255,0.6)" />
          <Text style={S.errText}>{error}</Text>
          <TouchableOpacity style={S.retryBtn} onPress={() => reload(activeQuery)}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !items.length ? (
        <View style={S.center}>
          <Ionicons name="film-outline" size={48} color="rgba(255,255,255,0.6)" />
          <Text style={S.emptyText}>
            {activeQuery ? `No videos for "${activeQuery}"` : 'No videos available'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          pagingEnabled
          snapToInterval={SCREEN_H}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={getItemLayout}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => reload(activeQuery, true)}
              tintColor="#fff"
              colors={['#fff']}
              progressBackgroundColor="#000"
            />
          }
          ListFooterComponent={
            loadingMore ? <View style={S.footerLoad}><ActivityIndicator color="#fff" /></View> : null
          }
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 10,
  },
  backBtn:    { padding: 6, marginRight: 4 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 22, height: 42,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  searchInput: {
    flex: 1, color: '#fff', fontSize: 14,
    paddingHorizontal: 8, paddingVertical: 0,
  },

  errText:   { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 14, textAlign: 'center' },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, marginTop: 14, textAlign: 'center' },
  retryBtn:  { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22, backgroundColor: '#3b82f6' },
  retryText: { color: '#fff', fontWeight: '700' },

  footerLoad:{ paddingVertical: 30, alignItems: 'center' },
});
