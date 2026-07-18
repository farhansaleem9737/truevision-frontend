// truevision/screens/SavedVideosScreen.js
//
// Saved/bookmarked videos. Backed by /api/videos/saved
// (videoService.getSavedVideos) with proper infinite scroll. Supports:
//   • debounced client-side title search
//   • per-tile unsave (bookmark button → toggleSave, optimistic + rollback)
//   • long-press multi-select → bulk remove (Promise.allSettled toggleSave)
//   • header menu "Clear all saved" — collects every saved id across pages
//     first, then unsaves them all with a blocking progress overlay
//   • tap → VideoPlayer with the full displayed list + initialIndex

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, FlatList, RefreshControl, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect }    from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons }          from '@expo/vector-icons';
import ScreenHeader          from '../components/settings/ScreenHeader';
import { useTheme }          from '../context/ThemeContext';
import videoService          from '../services/VideoService';

const { width } = Dimensions.get('window');
const GAP  = 2;
const COLS = 3;
const TILE = (width - GAP * (COLS - 1)) / COLS;
const HIT  = { top: 10, bottom: 10, left: 10, right: 10 };
const PAGE_SIZE = 30;

const fmt = (n) => {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

export default function SavedVideosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [items, setItems]             = useState([]);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState(null);

  // Client-side title search
  const [query, setQuery]                   = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Multi-select + bulk-operation state
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected]   = useState(() => new Set());
  const [busy, setBusy]           = useState(false);
  const [busyLabel, setBusyLabel] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Auto-exit selection mode when the last checkmark is removed.
  useEffect(() => {
    if (selecting && selected.size === 0) setSelecting(false);
  }, [selecting, selected]);

  // ── Data loading ──────────────────────────────────────────────────────────
  const load = useCallback(async (p = 1) => {
    const res = await videoService.getSavedVideos(p, PAGE_SIZE);
    if (res?.success) {
      const next = res.videos || [];
      setItems((prev) => {
        if (p === 1) return next;
        const seen = new Set(prev.map((v) => v._id));
        return [...prev, ...next.filter((v) => !seen.has(v._id))];
      });
      setPage(res.pagination?.page || p);
      setHasMore((res.pagination?.page || p) < (res.pagination?.pages || 1));
      setError(null);
    } else {
      setError(res?.message || 'Failed to load saved videos');
    }
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, []);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(1); };

  const onEndReached = () => {
    if (loadingMore || refreshing || loading || !hasMore) return;
    setLoadingMore(true);
    load(page + 1);
  };

  const displayed = useMemo(() => {
    if (!debouncedQuery) return items;
    return items.filter((v) => (v.title || '').toLowerCase().includes(debouncedQuery));
  }, [items, debouncedQuery]);

  // ── Open in player ────────────────────────────────────────────────────────
  const openVideo = (index) => {
    navigation.navigate('VideoPlayer', { videos: displayed, initialIndex: index });
  };

  // ── Single unsave (optimistic + rollback at original position) ───────────
  const removeOne = (video) => {
    let removedAt = 0;
    setItems((prev) => {
      const at = prev.findIndex((v) => v._id === video._id);
      removedAt = at < 0 ? 0 : at;
      return prev.filter((v) => v._id !== video._id);
    });
    videoService.toggleSave(video._id).then((res) => {
      if (res?.success) return;
      setItems((prev) => {
        if (prev.some((v) => v._id === video._id)) return prev;
        const next = [...prev];
        next.splice(Math.min(removedAt, next.length), 0, video);
        return next;
      });
      Alert.alert('Could not remove', 'The video was kept in your saved list. Please try again.');
    });
  };

  // ── Multi-select ──────────────────────────────────────────────────────────
  const startSelect = (id) => {
    setSelecting(true);
    setSelected(new Set([id]));
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelect = () => { setSelecting(false); setSelected(new Set()); };

  const removeSelected = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    Alert.alert(
      'Remove from Saved',
      `Remove ${ids.length} ${ids.length === 1 ? 'video' : 'videos'} from your saved list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => doRemoveSelected(ids) },
      ],
    );
  };

  const doRemoveSelected = async (ids) => {
    setBusy(true);
    setBusyLabel(`Removing ${ids.length} ${ids.length === 1 ? 'video' : 'videos'}…`);
    const results = await Promise.allSettled(ids.map((id) => videoService.toggleSave(id)));
    const okIds = new Set(
      ids.filter((id, i) => results[i].status === 'fulfilled' && results[i].value?.success)
    );
    setItems((prev) => prev.filter((v) => !okIds.has(v._id)));
    exitSelect();
    setBusy(false);
    setBusyLabel('');
    if (okIds.size < ids.length) {
      Alert.alert(
        'Partly removed',
        `${ids.length - okIds.size} of ${ids.length} videos could not be removed. Pull to refresh and try again.`,
      );
    }
  };

  // ── Clear all saved ───────────────────────────────────────────────────────
  const openHeaderMenu = () => {
    Alert.alert('Saved videos', undefined, [
      { text: 'Clear all saved', style: 'destructive', onPress: confirmClearAll },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const confirmClearAll = () => {
    if (items.length === 0) return;
    Alert.alert(
      'Clear all saved videos',
      "This removes every video from your saved list — including ones not loaded yet. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear all', style: 'destructive', onPress: doClearAll },
      ],
    );
  };

  const doClearAll = async () => {
    setBusy(true);
    setBusyLabel('Clearing saved videos…');
    try {
      // 1) Collect every saved id up-front. Unsaving while paginating would
      //    shift the pages underneath us, so gather ids first, then toggle.
      const ids = new Set(items.map((v) => v._id));
      let p = 1;
      let pages = 1;
      do {
        const res = await videoService.getSavedVideos(p, 50);
        if (!res?.success) break;
        (res.videos || []).forEach((v) => ids.add(v._id));
        pages = res.pagination?.pages || 1;
        p += 1;
      } while (p <= pages);

      // 2) Unsave them all; allSettled so one failure doesn't halt the rest.
      await Promise.allSettled([...ids].map((id) => videoService.toggleSave(id)));
    } finally {
      exitSelect();
      setQuery('');
      setLoading(true);
      await load(1); // reload from server — any failed toggles resurface here
      setBusy(false);
      setBusyLabel('');
    }
  };

  // ── Tile renderer ─────────────────────────────────────────────────────────
  const renderItem = ({ item, index }) => {
    const isSel = selected.has(item._id);
    return (
      <TouchableOpacity
        onPress={() => (selecting ? toggleSelect(item._id) : openVideo(index))}
        onLongPress={() => (selecting ? toggleSelect(item._id) : startSelect(item._id))}
        delayLongPress={280}
        activeOpacity={0.85}
        style={[S.tile, { backgroundColor: colors.iconChipBg }]}
      >
        {item.thumbnailUrl ? (
          <ExpoImage
            source={{ uri: item.thumbnailUrl }}
            style={S.tileImg}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[S.tileImg, S.tilePlaceholder]}>
            <Ionicons name="videocam-outline" size={22} color={colors.textDim} />
          </View>
        )}

        <View style={S.viewsBadge}>
          <Ionicons name="bookmark" size={11} color="#fff" />
          <Text style={S.viewsText}>{fmt(item.viewsCount)}</Text>
        </View>

        {selecting ? (
          <View
            style={[S.selScrim, isSel && S.selScrimActive]}
            pointerEvents="none"
          >
            <View style={[
              S.checkCircle,
              isSel && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}>
              {isSel ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={() => removeOne(item)} hitSlop={HIT} style={S.unsaveBtn}>
            <Ionicons name="bookmark" size={12} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader
        title={selecting ? `${selected.size} selected` : 'Saved Videos'}
        onBack={() => (selecting ? exitSelect() : navigation.goBack())}
        right={
          selecting ? (
            <TouchableOpacity
              onPress={removeSelected}
              disabled={selected.size === 0}
              hitSlop={HIT}
            >
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </TouchableOpacity>
          ) : items.length > 0 ? (
            <TouchableOpacity onPress={openHeaderMenu} hitSlop={HIT}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : null
        }
      />

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
                  placeholder="Search saved videos"
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
            </View>
          ) : null}

          <FlatList
            data={displayed}
            extraData={[selecting, selected]}
            keyExtractor={(it) => it._id}
            numColumns={COLS}
            columnWrapperStyle={{ gap: GAP }}
            contentContainerStyle={{ gap: GAP, paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.6}
            renderItem={renderItem}
            ListFooterComponent={
              loadingMore
                ? <View style={{ paddingVertical: 18 }}><ActivityIndicator color={colors.accent} /></View>
                : null
            }
            ListEmptyComponent={
              <View style={S.empty}>
                <Ionicons
                  name={debouncedQuery ? 'search-outline' : 'bookmark-outline'}
                  size={42}
                  color={colors.textDim}
                />
                <Text style={[S.emptyTitle, { color: colors.textMuted }]}>
                  {debouncedQuery ? 'No matches' : 'No saved videos yet'}
                </Text>
                <Text style={[S.emptySub, { color: colors.textDim }]}>
                  {debouncedQuery
                    ? `Nothing in your saved videos matches "${query.trim()}".`
                    : 'Tap the bookmark on a reel to save it here.'}
                </Text>
                {error ? <Text style={[S.errText, { color: colors.danger }]}>{error}</Text> : null}
              </View>
            }
          />
        </>
      )}

      {busy ? (
        <View style={[S.busyOverlay, { backgroundColor: colors.bg + 'E6' }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[S.busyText, { color: colors.textMuted }]}>{busyLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  controls: {
    paddingHorizontal: 14, paddingVertical: 10,
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

  tile:   { width: TILE, height: TILE },
  tileImg:{ width: '100%', height: '100%' },
  tilePlaceholder: { alignItems: 'center', justifyContent: 'center' },

  viewsBadge: {
    position: 'absolute', left: 6, bottom: 6,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  viewsText: { color: '#fff', fontSize: 10.5, fontWeight: '700', marginLeft: 3 },

  unsaveBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  selScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  selScrimActive: { backgroundColor: 'rgba(59,130,246,0.28)' },
  checkCircle: {
    position: 'absolute', top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  busyText: { fontSize: 13.5, fontWeight: '600', marginTop: 12 },

  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 14 },
  emptySub:   { fontSize: 13, marginTop: 6, textAlign: 'center' },
  errText:    { fontSize: 12, marginTop: 12, textAlign: 'center' },
});
