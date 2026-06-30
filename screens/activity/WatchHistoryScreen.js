// truevision/screens/activity/WatchHistoryScreen.js
//
// TikTok / YouTube-style Watch History. Three-column grid of previously
// watched videos, newest first. Features:
//   • Pull-to-refresh
//   • Infinite scroll (page=1..N)
//   • Skeleton on first load
//   • Per-tile X to remove (default mode)
//   • Header "Select" → multi-select mode with checkmarks + bottom toolbar
//   • Header trash → Clear-all (custom confirmation modal)
//   • Tap tile → open VideoPlayer with resume position pre-filled
//   • Empty state with "Explore Videos" CTA
//
// Backend: /api/activity/watch-history (mounted in Backend/routes/ActivityRoutes.js).

import { useCallback, useMemo, useState } from 'react';
import {
  Dimensions, FlatList, RefreshControl, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader            from '../../components/settings/ScreenHeader';
import WatchHistoryCard        from '../../components/activity/WatchHistoryCard';
import WatchHistorySkeleton    from '../../components/activity/WatchHistorySkeleton';
import EmptyWatchHistory       from '../../components/activity/EmptyWatchHistory';
import SelectionToolbar        from '../../components/activity/SelectionToolbar';
import ConfirmationModal       from '../../components/activity/ConfirmationModal';

import { useTheme }      from '../../context/ThemeContext';
import activityService   from '../../services/ActivityService';

// ── Layout tokens (kept in sync with WatchHistorySkeleton) ──────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const SIDE_PAD = 16;
const GAP      = 10;
const COLS     = 3;
const TILE_W   = (SCREEN_W - SIDE_PAD * 2 - GAP * (COLS - 1)) / COLS;

const PAGE_LIMIT = 30;

export default function WatchHistoryScreen({ navigation }) {
  const insets   = useSafeAreaInsets();
  const { colors } = useTheme();

  // ── Data state ─────────────────────────────────────────────────────────
  const [items, setItems]               = useState([]);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(true);
  const [loading, setLoading]           = useState(true);    // first-load skeleton
  const [refreshing, setRefreshing]     = useState(false);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [error, setError]               = useState(null);

  // ── Selection state ────────────────────────────────────────────────────
  // Keeping a Set in component state — for the row volumes we expect this
  // is plenty fast and avoids the constant prop-drilling of an array.
  const [selectMode, setSelectMode]     = useState(false);
  const [selected, setSelected]         = useState(() => new Set());

  // ── Modal state ────────────────────────────────────────────────────────
  const [modal, setModal] = useState(null); // null | 'clear' | 'bulk'

  // ── Load / refresh / paginate ──────────────────────────────────────────
  const load = useCallback(async (p = 1, mode = 'replace') => {
    if (mode === 'replace' && p === 1) setError(null);

    const res = await activityService.getWatchHistory(p, PAGE_LIMIT);
    if (!res?.success) {
      setError(res?.message || 'Failed to load watch history');
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      return;
    }

    const next = res.items || [];
    setItems((prev) => (mode === 'replace' ? next : [...prev, ...next]));
    setPage(res.pagination?.page || p);
    setHasMore((res.pagination?.page || p) < (res.pagination?.pages || 1));

    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load(1, 'replace');
  }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(1, 'replace');
  }, [load]);

  const onEndReached = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    load(page + 1, 'append');
  }, [loadingMore, hasMore, loading, page, load]);

  // ── Selection helpers ─────────────────────────────────────────────────
  const toggleSelected = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  }, []);

  const enterSelectMode = useCallback((preselectId) => {
    setSelectMode(true);
    setSelected(preselectId ? new Set([preselectId]) : new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  // ── Mutations ─────────────────────────────────────────────────────────
  const removeOne = useCallback(async (videoId) => {
    // Optimistic: drop the tile immediately, restore on failure.
    const snapshot = items;
    setItems((prev) => prev.filter((it) => (it.video?._id || it.video?.id) !== videoId));
    const res = await activityService.deleteWatch(videoId);
    if (!res?.success) setItems(snapshot);
  }, [items]);

  const clearAll = useCallback(async () => {
    setModal(null);
    const snapshot = items;
    setItems([]); setPage(1); setHasMore(false);
    const res = await activityService.clearWatch();
    if (!res?.success) { setItems(snapshot); load(1, 'replace'); }
  }, [items, load]);

  const bulkDelete = useCallback(async () => {
    setModal(null);
    const ids = [...selected];
    if (!ids.length) return;

    const snapshot = items;
    setItems((prev) => prev.filter((it) => !selected.has(it._id)));
    exitSelectMode();

    const res = await activityService.bulkDeleteWatch(ids);
    if (!res?.success) setItems(snapshot);
  }, [items, selected, exitSelectMode]);

  // ── Tile interactions ──────────────────────────────────────────────────
  const onPressTile = useCallback((it) => {
    if (selectMode) {
      toggleSelected(it._id);
      return;
    }
    const v = it.video || {};
    navigation.navigate('VideoPlayer', {
      videoId:         v._id,
      // Pre-fill resume position so the player can seek on ready.
      resumePosition:  it.lastPlaybackPosition || 0,
    });
  }, [navigation, selectMode, toggleSelected]);

  const onLongPressTile = useCallback((it) => {
    if (!selectMode) enterSelectMode(it._id);
  }, [selectMode, enterSelectMode]);

  // ── Header right control ───────────────────────────────────────────────
  const headerRight = useMemo(() => {
    // In select mode the SelectionToolbar takes care of actions, so the
    // header's right slot just shows a trash for clear-all.
    if (selectMode || items.length === 0) {
      return items.length > 0 ? (
        <TouchableOpacity onPress={() => setModal('clear')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
        </TouchableOpacity>
      ) : null;
    }
    return (
      <TouchableOpacity
        onPress={() => enterSelectMode(null)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '800' }}>
          Select
        </Text>
      </TouchableOpacity>
    );
  }, [selectMode, items.length, colors, enterSelectMode]);

  // ── Render ─────────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }) => (
    <WatchHistoryCard
      item={item}
      width={TILE_W}
      selectionMode={selectMode}
      selected={selected.has(item._id)}
      onPress={() => onPressTile(item)}
      onLongPress={() => onLongPressTile(item)}
      onRemove={() => removeOne(item.video?._id || item.video?.id)}
    />
  ), [selectMode, selected, onPressTile, onLongPressTile, removeOne]);

  const keyExtractor = useCallback((it) => String(it._id), []);

  // First-load: skeleton
  if (loading && items.length === 0) {
    return (
      <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
        <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
        <ScreenHeader title="Watch History" onBack={() => navigation.goBack()} />
        <WatchHistorySkeleton rows={3} />
      </View>
    );
  }

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />

      <ScreenHeader
        title={selectMode ? 'Select Videos' : 'Watch History'}
        onBack={selectMode ? exitSelectMode : (() => navigation.goBack())}
        right={headerRight}
      />

      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GAP, paddingHorizontal: SIDE_PAD }}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: selectMode ? 90 : 32,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          loadingMore
            ? (
              <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                <Text style={{ color: colors.textDim, fontSize: 12 }}>Loading more…</Text>
              </View>
            )
            : null
        }
        ListEmptyComponent={
          error ? (
            <View style={S.errorBox}>
              <Ionicons name="cloud-offline-outline" size={42} color={colors.textDim} />
              <Text style={[S.errorTitle, { color: colors.text }]}>Couldn&apos;t load history</Text>
              <Text style={[S.errorSub,   { color: colors.textMuted }]}>{error}</Text>
              <TouchableOpacity
                onPress={() => { setLoading(true); load(1, 'replace'); }}
                style={[S.retryBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <EmptyWatchHistory
              onExplore={() => navigation.navigate('MainApp', { screen: 'Home' })}
            />
          )
        }
      />

      {/* Bottom selection toolbar — only visible in select mode */}
      {selectMode ? (
        <SelectionToolbar
          selectedCount={selected.size}
          onCancel={exitSelectMode}
          onDeleteSelected={() => setModal('bulk')}
        />
      ) : null}

      {/* Confirmation modals */}
      <ConfirmationModal
        visible={modal === 'clear'}
        title="Clear watch history?"
        message="This removes every video from your watch history. This action can't be undone."
        confirmLabel="Clear all"
        onCancel={() => setModal(null)}
        onConfirm={clearAll}
      />
      <ConfirmationModal
        visible={modal === 'bulk'}
        title={`Delete ${selected.size} ${selected.size === 1 ? 'item' : 'items'}?`}
        message="The selected videos will be removed from your watch history."
        confirmLabel="Delete"
        onCancel={() => setModal(null)}
        onConfirm={bulkDelete}
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1 },

  errorBox: {
    alignItems: 'center', paddingTop: 80, paddingHorizontal: 32,
  },
  errorTitle: { fontSize: 16, fontWeight: '800', marginTop: 14 },
  errorSub:   { fontSize: 13, marginTop: 6, textAlign: 'center' },
  retryBtn: {
    marginTop: 18,
    paddingHorizontal: 22, paddingVertical: 10,
    borderRadius: 999,
  },
});
