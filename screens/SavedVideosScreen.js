// truevision/screens/SavedVideosScreen.js
//
// Lists videos the user has saved/bookmarked. Backed by the existing
// /api/videos/saved endpoint (own videos) plus the local AsyncStorage set
// of saved Pexels IDs (so external bookmarks show up too — though full
// playback for those still uses the original Pexels URL).

import { useState, useCallback } from 'react';
import {
  ActivityIndicator, Dimensions, FlatList, RefreshControl, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect }    from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons }          from '@expo/vector-icons';
import ScreenHeader          from '../components/settings/ScreenHeader';
import videoService          from '../services/VideoService';

const { width } = Dimensions.get('window');
const GAP = 2;
const COLS = 3;
const TILE = (width - GAP * (COLS - 1)) / COLS;

const fmt = (n) => {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

export default function SavedVideosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    const res = await videoService.getSavedVideos(1, 30);
    if (res.success) {
      setItems(res.videos || []);
      setError(null);
    } else {
      setError(res.message || 'Failed to load saved videos');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScreenHeader title="Saved Videos" onBack={() => navigation.goBack()} />

      {loading && items.length === 0 ? (
        <View style={S.center}><ActivityIndicator color="#3b82f6" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it._id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('VideoPlayer', { videoId: item._id })}
              activeOpacity={0.85}
              style={S.tile}
            >
              {item.thumbnailUrl ? (
                <ExpoImage source={{ uri: item.thumbnailUrl }} style={S.tileImg}
                  contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[S.tileImg, S.tilePlaceholder]}>
                  <Ionicons name="videocam-outline" size={22} color="rgba(15,23,42,0.35)" />
                </View>
              )}
              <View style={S.viewsBadge}>
                <Ionicons name="bookmark" size={11} color="#fff" />
                <Text style={S.viewsText}>{fmt(item.viewsCount)}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={S.empty}>
              <Ionicons name="bookmark-outline" size={42} color="#cbd5e1" />
              <Text style={S.emptyTitle}>No saved videos yet</Text>
              <Text style={S.emptySub}>
                Tap the bookmark on a reel to save it here.
              </Text>
              {error ? <Text style={S.errText}>{error}</Text> : null}
            </View>
          }
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  tile:   { width: TILE, height: TILE, backgroundColor: '#f1f5f9' },
  tileImg:{ width: '100%', height: '100%' },
  tilePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  viewsBadge: {
    position: 'absolute', left: 6, bottom: 6,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  viewsText: { color: '#fff', fontSize: 10.5, fontWeight: '700', marginLeft: 3 },

  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 14 },
  emptySub:   { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center' },
  errText:    { fontSize: 12, color: '#ef4444', marginTop: 12, textAlign: 'center' },
});
