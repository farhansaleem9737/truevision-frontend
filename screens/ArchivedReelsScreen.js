// truevision/screens/ArchivedReelsScreen.js
//
// Grid of the current user's archived reels. Reached from Profile → "Archived"
// entry point (a menu item added to the profile's More Options sheet, or from
// the Manage-your-reel sheet after archiving).
//
// Each tile has a Restore action that flips isArchived back to false via
// PUT /api/videos/:id/archive with { archived: false }. On restore, we
// remove the tile from the list without a full refetch. Pull-to-refresh
// fetches page 1 again; scroll-to-bottom pages forward.
//
// The video must be tapped to open in the standard VideoPlayerScreen — the
// archive tag doesn't disable playback for the owner, only public visibility.

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image, StatusBar,
  ActivityIndicator, StyleSheet, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import videoService from '../services/VideoService';
import { useTheme } from '../context/ThemeContext';

const COLS = 3;

export default function ArchivedReelsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const palette = isDark ? DARK : LIGHT;

  const [videos,     setVideos]     = useState([]);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restoring,  setRestoring]  = useState(null); // videoId being restored
  const [error,      setError]      = useState('');

  const loadPage = useCallback(async (pageNum, replace = false) => {
    if (!hasMore && !replace) return;
    setError('');
    const res = await videoService.getArchivedVideos(pageNum, 12);
    if (!res?.success) {
      setError(res?.message || 'Could not load archived reels');
      setLoading(false); setRefreshing(false);
      return;
    }
    setVideos((prev) => replace ? res.videos : [...prev, ...res.videos]);
    setHasMore((res.pagination?.page ?? pageNum) < (res.pagination?.pages ?? pageNum));
    setPage(pageNum);
    setLoading(false); setRefreshing(false);
  }, [hasMore]);

  useEffect(() => { loadPage(1, true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    loadPage(1, true);
  }, [loadPage]);

  const onEndReached = useCallback(() => {
    if (loading || refreshing || !hasMore) return;
    loadPage(page + 1);
  }, [loading, refreshing, hasMore, page, loadPage]);

  const onRestore = useCallback(async (video) => {
    if (restoring) return;
    setRestoring(video._id);
    const res = await videoService.toggleArchive(video._id, false);
    setRestoring(null);
    if (res?.success) {
      // Optimistically remove — the grid rebuilds from the trimmed list.
      setVideos((prev) => prev.filter((v) => v._id !== video._id));
    } else {
      setError(res?.message || 'Restore failed');
    }
  }, [restoring]);

  const renderTile = ({ item }) => (
    <View style={S.tileWrap}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('VideoPlayer', { video: item, videoId: item._id })}
        style={[S.tile, { backgroundColor: palette.tileBg }]}
      >
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={S.thumb} />
        ) : (
          <View style={[S.thumb, S.thumbFallback, { backgroundColor: palette.tileBg }]}>
            <Ionicons name="videocam" size={22} color={palette.textMuted} />
          </View>
        )}
        <View style={S.tileMeta}>
          <Ionicons name="eye-outline" size={12} color="#fff" />
          <Text style={S.tileMetaText}>{shortNum(item.viewsCount)}</Text>
        </View>
        <View style={S.archivedBadge}>
          <Ionicons name="archive" size={11} color="#fff" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onRestore(item)}
        activeOpacity={0.85}
        disabled={restoring === item._id}
        style={[S.restoreBtn, { backgroundColor: palette.accent, opacity: restoring === item._id ? 0.6 : 1 }]}
      >
        {restoring === item._id ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="refresh" size={13} color="#fff" />
            <Text style={S.restoreText}>Restore</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[S.root, { backgroundColor: palette.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[S.header, { paddingTop: insets.top + 8, borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={palette.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[S.hTitle, { color: palette.text }]}>Archived</Text>
          <Text style={[S.hSub,   { color: palette.textMuted }]}>Only you can see these reels</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      {loading && videos.length === 0 ? (
        <View style={S.stateBox}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      ) : videos.length === 0 ? (
        <View style={S.stateBox}>
          <View style={[S.emptyIcon, { backgroundColor: palette.card }]}>
            <Ionicons name="archive-outline" size={30} color={palette.textMuted} />
          </View>
          <Text style={[S.emptyTitle, { color: palette.text }]}>No archived reels</Text>
          <Text style={[S.emptyBody,  { color: palette.textMuted }]}>
            Reels you archive from the "Manage your reel" sheet appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(v) => String(v._id || v.id)}
          numColumns={COLS}
          renderItem={renderTile}
          contentContainerStyle={{ padding: 8, paddingBottom: 32 + insets.bottom }}
          columnWrapperStyle={{ gap: 8 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.accent}
              colors={[palette.accent]}
            />
          }
        />
      )}

      {!!error && (
        <View style={[S.toast, { backgroundColor: palette.dangerSoft }]}>
          <Ionicons name="alert-circle" size={16} color={palette.danger} />
          <Text style={[S.toastText, { color: palette.danger }]}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const shortNum = (n) => {
  if (n == null) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const DARK = {
  bg:         '#0b0b0f',
  card:       'rgba(255,255,255,0.06)',
  tileBg:     '#1a1a20',
  border:     'rgba(255,255,255,0.08)',
  text:       '#f5f5f7',
  textMuted:  '#a1a1aa',
  accent:     '#22C55E',
  danger:     '#ff5a5f',
  dangerSoft: 'rgba(255,90,95,0.15)',
};

const LIGHT = {
  bg:         '#f8fafc',
  card:       '#ffffff',
  tileBg:     '#eef2f7',
  border:     '#e2e8f0',
  text:       '#0f172a',
  textMuted:  '#64748b',
  accent:     '#16a34a',
  danger:     '#ef4444',
  dangerSoft: '#fef2f2',
};

const S = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  hTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 0.15 },
  hSub:   { fontSize: 11.5, marginTop: 2, fontWeight: '500' },

  stateBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  emptyBody:  { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  tileWrap: {
    flex: 1 / COLS,
    marginTop: 0,
  },
  tile: {
    aspectRatio: 9 / 16,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  tileMeta: {
    position: 'absolute', bottom: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tileMetaText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
  archivedBadge: {
    position: 'absolute', top: 6, left: 6,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  restoreBtn: {
    marginTop: 6,
    borderRadius: 10,
    paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  restoreText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

  toast: {
    position: 'absolute', left: 12, right: 12, bottom: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10,
  },
  toastText: { fontSize: 13, fontWeight: '600', flex: 1 },
});
