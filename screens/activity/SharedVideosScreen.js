// truevision/screens/activity/SharedVideosScreen.js
//
// Timeline of share events. Each row is a (video, method, recipient, sharedAt)
// tuple — re-sharing the same video twice = two tiles. Backed by
// /api/activity/shared-videos. Newer rows also carry `recipient`
// ({_id, username, fullName, profileImage} | null) and `method` (e.g. 'chat',
// 'system_share'); older rows only have `platform` — both shapes are handled.

import { useCallback, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/settings/ScreenHeader';
import VideoTileGrid from '../../components/activity/VideoTileGrid';
import { useTheme } from '../../context/ThemeContext';
import { useConfirm } from '../../components/common/ConfirmProvider';
import activityService from '../../services/ActivityService';

// Compact relative timestamp for the per-tile share-date pill.
const timeAgo = (date) => {
  if (!date) return '';
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60)     return 'now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Human-friendly label for the share-method badge.
const methodLabel = (m) => {
  if (!m) return '';
  if (m === 'chat')         return 'Chat';
  if (m === 'system_share') return 'Shared externally';
  return m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export default function SharedVideosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const confirm = useConfirm();

  const [items, setItems]         = useState([]);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(true);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (p = 1) => {
    const res = await activityService.getSharedVideos(p, 21);
    if (res?.success) {
      // Flatten each share row → enriched video object carrying the share
      // metadata for tile rendering + delete-by-row. `recipient`/`method`
      // only exist on newer rows; older rows fall back to `platform`.
      const videos = (res.items || [])
        .filter((r) => r.video)
        .map((r) => ({
          ...r.video,
          _shareId:   r._id,
          _method:    r.method || r.platform || '',
          _recipient: r.recipient || null,
          _sharedAt:  r.sharedAt,
        }));
      setItems((prev) => {
        if (p === 1) return videos;
        // The API can re-serve rows across page boundaries — dedupe appended
        // pages by share id so React keys stay unique.
        const seen = new Set(prev.map((v) => v._shareId));
        return [...prev, ...videos.filter((v) => !seen.has(v._shareId))];
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
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    load(page + 1);
  };

  const clearAll = async () => {
    if (items.length === 0) return;
    const ok = await confirm({
      title:       'Clear shared videos',
      message:     "This removes every entry from your share history. This can't be undone.",
      confirmText: 'Clear all',
      destructive: true,
      icon:        'trash-outline',
    });
    if (!ok) return;
    await activityService.clearShares();
    setItems([]); setPage(1); setHasMore(false);
  };

  const removeOne = (shareId) => {
    setItems((prev) => prev.filter((v) => v._shareId !== shareId));
    activityService.deleteShare(shareId);
  };

  // Open in the player with the displayed list. The player keys items by
  // video _id, so collapse duplicate shares of the same video first — then
  // locate the tapped tile in the deduped list.
  const openVideo = (video) => {
    const seen = new Set();
    const unique = items.filter((v) => {
      const k = String(v._id);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const idx = unique.findIndex((v) => String(v._id) === String(video._id));
    navigation.navigate('VideoPlayer', {
      videos: unique,
      initialIndex: Math.max(0, idx),
    });
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader
        title="Shared Videos"
        onBack={() => navigation.goBack()}
        right={
          items.length > 0 ? (
            <TouchableOpacity onPress={clearAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </TouchableOpacity>
          ) : null
        }
      />

      {loading && items.length === 0 ? (
        <View style={S.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <VideoTileGrid
          items={items}
          onPressItem={openVideo}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={onEndReached}
          loadingMore={loadingMore}
          emptyIcon="paper-plane-outline"
          emptyTitle="No shared videos yet"
          emptySub="Videos you share will show up here."
          badgeIcon="paper-plane"
          badgeValueOf={(v) => methodLabel(v._method)}
          renderOverlay={(v) => (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {v._recipient ? (
                <View style={S.recipientStrip}>
                  {v._recipient.profileImage ? (
                    <ExpoImage
                      source={{ uri: v._recipient.profileImage }}
                      style={S.recipAvatar}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[S.recipAvatar, S.recipFallback]}>
                      <Text style={S.recipInitial}>
                        {(v._recipient.username || v._recipient.fullName || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={S.recipText} numberOfLines={1}>
                    to @{v._recipient.username || 'user'}
                  </Text>
                </View>
              ) : null}
              {/* Share date — rendered for every row, including legacy ones
                  with no recipient. */}
              <View style={S.datePill}>
                <Text style={S.dateText}>{timeAgo(v._sharedAt)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => removeOne(v._shareId)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={S.deleteBadge}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  deleteBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  recipientStrip: {
    position: 'absolute', top: 6, left: 6,
    maxWidth: '72%',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 3,
  },
  recipAvatar: { width: 14, height: 14, borderRadius: 7, marginRight: 4 },
  recipFallback: {
    backgroundColor: '#64748b',
    alignItems: 'center', justifyContent: 'center',
  },
  recipInitial: { color: '#fff', fontSize: 8, fontWeight: '800' },
  recipText: { color: '#fff', fontSize: 9.5, fontWeight: '700', flexShrink: 1 },
  datePill: {
    position: 'absolute', right: 6, bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  dateText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
});
