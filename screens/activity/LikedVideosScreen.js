// truevision/screens/activity/LikedVideosScreen.js
//
// Lists videos the current user has liked. Backed by the existing
// /api/videos/liked endpoint (videoService.getLikedVideos). Unliking from
// here calls toggleLike just like the reel cards.

import { useCallback, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import ScreenHeader from '../../components/settings/ScreenHeader';
import VideoTileGrid from '../../components/activity/VideoTileGrid';
import { useTheme } from '../../context/ThemeContext';
import videoService from '../../services/VideoService';

export default function LikedVideosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [items, setItems]         = useState([]);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(true);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (p = 1) => {
    const res = await videoService.getLikedVideos(p, 21);
    if (res?.success) {
      const next = res.videos || [];
      setItems((prev) => (p === 1 ? next : [...prev, ...next]));
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

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Liked Videos" onBack={() => navigation.goBack()} />

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
          emptyIcon="heart-outline"
          emptyTitle="No liked videos yet"
          emptySub="Tap the heart on a reel to like it."
          badgeIcon="heart"
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
