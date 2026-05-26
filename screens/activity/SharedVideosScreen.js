// truevision/screens/activity/SharedVideosScreen.js
//
// Timeline of share events. Each row is a (video, platform, sharedAt) tuple
// — re-sharing the same video to two platforms = two tiles. Backed by
// /api/activity/shared-videos.

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/settings/ScreenHeader';
import VideoTileGrid from '../../components/activity/VideoTileGrid';
import { useTheme } from '../../context/ThemeContext';
import activityService from '../../services/ActivityService';

export default function SharedVideosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [items, setItems]         = useState([]);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(true);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (p = 1) => {
    const res = await activityService.getSharedVideos(p, 21);
    if (res?.success) {
      // Flatten { _id, video, platform, sharedAt } → enriched video object
      // carrying the share metadata for tile rendering + delete-by-row.
      const videos = (res.items || [])
        .filter((r) => r.video)
        .map((r) => ({
          ...r.video,
          _shareId:  r._id,
          _platform: r.platform,
          _sharedAt: r.sharedAt,
        }));
      setItems((prev) => (p === 1 ? videos : [...prev, ...videos]));
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

  const clearAll = () => {
    if (items.length === 0) return;
    Alert.alert(
      'Clear shared videos',
      "This removes every entry from your share history. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all', style: 'destructive',
          onPress: async () => {
            await activityService.clearShares();
            setItems([]); setPage(1); setHasMore(false);
          },
        },
      ],
    );
  };

  const removeOne = (shareId) => {
    setItems((prev) => prev.filter((v) => v._shareId !== shareId));
    activityService.deleteShare(shareId);
  };

  // Short, human-friendly platform label drawn on the badge.
  const platformLabel = (p) => {
    if (!p) return '';
    if (p === 'system_share') return 'share';
    return p.replace(/_/g, ' ');
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
          onPressItem={(v) => navigation.navigate('VideoPlayer', { videoId: v._id })}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={onEndReached}
          loadingMore={loadingMore}
          emptyIcon="paper-plane-outline"
          emptyTitle="No shared videos yet"
          emptySub="Videos you share will show up here."
          badgeIcon="paper-plane"
          badgeValueOf={(v) => platformLabel(v._platform)}
          renderOverlay={(v) => (
            <TouchableOpacity
              onPress={() => removeOne(v._shareId)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={S.deleteBadge}
            >
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
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
});
