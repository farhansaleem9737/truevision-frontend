// truevision/screens/activity/WatchHistoryScreen.js
//
// Lists videos the user has watched, most recent first. Backed by
// /api/activity/watch-history. Recording happens automatically via the
// existing recordView endpoint (piggybacked in VideoController.recordView).

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/settings/ScreenHeader';
import VideoTileGrid from '../../components/activity/VideoTileGrid';
import { useTheme } from '../../context/ThemeContext';
import activityService from '../../services/ActivityService';

export default function WatchHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [items, setItems]         = useState([]);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(true);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (p = 1) => {
    const res = await activityService.getWatchHistory(p, 20);
    if (res?.success) {
      // Flatten: each row is { _id, video, watchedAt, lastPosition }.
      // Attach activityId so the per-tile delete button can target one row.
      const videos = (res.items || [])
        .filter((r) => r.video)
        .map((r) => ({ ...r.video, _activityId: r._id, _watchedAt: r.watchedAt }));
      setItems(p === 1 ? videos : (prev) => [...prev, ...videos]);
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
      'Clear watch history',
      "This removes every video from your watch history. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all', style: 'destructive',
          onPress: async () => {
            await activityService.clearWatch();
            setItems([]); setPage(1); setHasMore(false);
          },
        },
      ],
    );
  };

  const removeOne = (videoId) => {
    Alert.alert(
      'Remove from history',
      'Remove this video from your watch history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            // Optimistic update — drop the tile first, then call the API.
            setItems((prev) => prev.filter((v) => v._id !== videoId));
            await activityService.deleteWatch(videoId);
          },
        },
      ],
    );
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader
        title="Watch History"
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
          emptyIcon="time-outline"
          emptyTitle="No watch history yet"
          emptySub="Videos you watch will appear here."
          badgeIcon="time"
          badgeValueOf={() => ''}
          renderOverlay={(v) => (
            <TouchableOpacity
              onPress={() => removeOne(v._id)}
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
