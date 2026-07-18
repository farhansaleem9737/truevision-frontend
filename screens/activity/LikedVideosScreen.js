// truevision/screens/activity/LikedVideosScreen.js
//
// Lists videos the current user has liked. Backed by the existing
// /api/videos/liked endpoint (videoService.getLikedVideos). Unliking from
// here calls toggleLike just like the reel cards — optimistic removal with
// rollback on failure. Includes a debounced client-side title search and a
// Recent / Oldest / Most Viewed sort over the loaded list.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, StatusBar, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/settings/ScreenHeader';
import VideoTileGrid from '../../components/activity/VideoTileGrid';
import { useTheme } from '../../context/ThemeContext';
import videoService from '../../services/VideoService';

const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

const SORTS = [
  { id: 'recent', label: 'Recent' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'views',  label: 'Most Viewed' },
];

export default function LikedVideosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [items, setItems]         = useState([]);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(true);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Search + sort (both client-side, applied to the loaded list)
  const [query, setQuery]                   = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortMode, setSortMode]             = useState('recent');

  // Debounce the search input so we don't re-filter on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async (p = 1) => {
    const res = await videoService.getLikedVideos(p, 21);
    if (res?.success) {
      const next = res.videos || [];
      setItems((prev) => {
        if (p === 1) return next;
        const seen = new Set(prev.map((v) => v._id));
        return [...prev, ...next.filter((v) => !seen.has(v._id))];
      });
      setPage(res.pagination?.page || p);
      setHasMore((res.pagination?.page || p) < (res.pagination?.pages || 1));
    }
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, []);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(1); };

  const onEndReached = () => {
    if (loadingMore || refreshing || !hasMore) return;
    setLoadingMore(true);
    load(page + 1);
  };

  // What the grid actually shows: filtered by title, then sorted.
  // Server returns newest-first, so 'recent' is the list as-is and 'oldest'
  // its reverse. 'views' uses decorate-sort-undecorate so the sort is stable
  // (ties keep their recency order) regardless of the JS engine.
  const displayed = useMemo(() => {
    let list = items;
    if (debouncedQuery) {
      list = list.filter((v) => (v.title || '').toLowerCase().includes(debouncedQuery));
    }
    if (sortMode === 'oldest') return [...list].reverse();
    if (sortMode === 'views') {
      return list
        .map((v, i) => ({ v, i }))
        .sort((a, b) => ((b.v.viewsCount || 0) - (a.v.viewsCount || 0)) || (a.i - b.i))
        .map(({ v }) => v);
    }
    return list;
  }, [items, debouncedQuery, sortMode]);

  // Open the tapped video inside the currently displayed (filtered/sorted)
  // list so the player starts on exactly the tile that was tapped.
  const openVideo = useCallback((video) => {
    const idx = displayed.findIndex((v) => v._id === video._id);
    navigation.navigate('VideoPlayer', {
      videos: displayed,
      initialIndex: Math.max(0, idx),
    });
  }, [displayed, navigation]);

  // Unlike from the list — optimistic removal, rollback (at the original
  // position) if the toggle fails.
  const unlike = useCallback((video) => {
    let removedAt = 0;
    setItems((prev) => {
      const at = prev.findIndex((v) => v._id === video._id);
      removedAt = at < 0 ? 0 : at;
      return prev.filter((v) => v._id !== video._id);
    });
    videoService.toggleLike(video._id).then((res) => {
      if (res?.success) return;
      setItems((prev) => {
        if (prev.some((v) => v._id === video._id)) return prev;
        const next = [...prev];
        next.splice(Math.min(removedAt, next.length), 0, video);
        return next;
      });
      Alert.alert('Could not unlike', 'The video was kept in your liked list. Please try again.');
    });
  }, []);

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Liked Videos" onBack={() => navigation.goBack()} />

      {loading && items.length === 0 ? (
        <View style={S.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <>
          {items.length > 0 ? (
            <View style={[S.controls, { borderBottomColor: colors.divider }]}>
              <View style={[S.searchBar, { backgroundColor: colors.iconChipBg }]}>
                <Ionicons name="search" size={16} color={colors.textDim} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search liked videos"
                  placeholderTextColor={colors.textDim}
                  style={[S.searchInput, { color: colors.text }]}
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query.length > 0 ? (
                  <TouchableOpacity onPress={() => setQuery('')} hitSlop={HIT}>
                    <Ionicons name="close-circle" size={16} color={colors.textDim} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={S.sortRow}>
                {SORTS.map((s) => {
                  const active = s.id === sortMode;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => setSortMode(s.id)}
                      activeOpacity={0.7}
                      style={[S.sortChip, { backgroundColor: active ? colors.text : colors.iconChipBg }]}
                    >
                      <Text style={[
                        S.sortLabel,
                        { color: active ? colors.bg : colors.textMuted, fontWeight: active ? '700' : '600' },
                      ]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          <VideoTileGrid
            items={displayed}
            onPressItem={openVideo}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onEndReached={onEndReached}
            loadingMore={loadingMore}
            emptyIcon={debouncedQuery ? 'search-outline' : 'heart-outline'}
            emptyTitle={debouncedQuery ? 'No matches' : 'No liked videos yet'}
            emptySub={debouncedQuery
              ? `Nothing in your liked videos matches "${query.trim()}".`
              : 'Tap the heart on a reel to like it.'}
            badgeIcon="heart"
            renderOverlay={(v) => (
              <TouchableOpacity
                onPress={() => unlike(v)}
                hitSlop={HIT}
                style={S.unlikeBtn}
              >
                <Ionicons name="heart-dislike" size={13} color="#fff" />
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  controls: {
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1, marginLeft: 8,
    fontSize: 14, paddingVertical: 0,
  },
  sortRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  sortChip: {
    paddingHorizontal: 13, paddingVertical: 6,
    borderRadius: 16,
  },
  sortLabel: { fontSize: 12.5 },

  unlikeBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
});
