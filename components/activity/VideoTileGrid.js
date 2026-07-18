// truevision/components/activity/VideoTileGrid.js
//
// 3-column video-thumbnail grid used by the Liked Videos and Shared Videos
// screens. Same visual language as SavedVideosScreen.
//
// Props:
//   items         — Video[] (or anything with thumbnailUrl/_id/viewsCount)
//   onPressItem   — (video) => void
//   refreshing    — bool, drives RefreshControl
//   onRefresh     — () => void
//   onEndReached  — () => void, infinite scroll
//   loadingMore   — bool, footer spinner
//   emptyIcon     — Ionicons name (default 'film-outline')
//   emptyTitle    — string
//   emptySub      — string
//   badgeIcon     — Ionicons name shown on each tile (default 'eye')
//   badgeValueOf  — (video) => string|number, drives the per-tile badge label
//   renderOverlay — optional (item) => ReactNode, drawn over each tile
//                    (e.g. delete button for Shared Videos rows)

import { ActivityIndicator, Dimensions, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

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

export default function VideoTileGrid({
  items,
  onPressItem,
  refreshing = false,
  onRefresh,
  onEndReached,
  loadingMore = false,
  emptyIcon  = 'film-outline',
  emptyTitle = 'Nothing here yet',
  emptySub   = '',
  badgeIcon  = 'eye',
  badgeValueOf,
  renderOverlay,
}) {
  const { colors } = useTheme();

  return (
    <FlatList
      data={items}
      keyExtractor={(it, i) => String(it._shareId || it._id || it.id || i)}
      numColumns={COLS}
      columnWrapperStyle={{ gap: GAP }}
      contentContainerStyle={{ gap: GAP, paddingBottom: 60 }}
      refreshControl={
        onRefresh
          ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          : undefined
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      ListFooterComponent={
        loadingMore
          ? <View style={{ paddingVertical: 18 }}><ActivityIndicator color={colors.accent} /></View>
          : null
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => onPressItem?.(item)}
          activeOpacity={0.85}
          style={[S.tile, { backgroundColor: colors.iconChipBg }]}
        >
          {item.thumbnailUrl ? (
            <ExpoImage source={{ uri: item.thumbnailUrl }} style={S.tileImg}
              contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[S.tileImg, S.tilePlaceholder]}>
              <Ionicons name="videocam-outline" size={22} color={colors.textDim} />
            </View>
          )}
          <View style={S.badge}>
            <Ionicons name={badgeIcon} size={11} color="#fff" />
            <Text style={S.badgeText}>
              {badgeValueOf ? badgeValueOf(item) : fmt(item.viewsCount)}
            </Text>
          </View>
          {renderOverlay ? renderOverlay(item) : null}
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={S.empty}>
          <Ionicons name={emptyIcon} size={42} color={colors.textDim} />
          <Text style={[S.emptyTitle, { color: colors.textMuted }]}>{emptyTitle}</Text>
          {emptySub
            ? <Text style={[S.emptySub, { color: colors.textDim }]}>{emptySub}</Text>
            : null}
        </View>
      }
    />
  );
}

const S = StyleSheet.create({
  tile:    { width: TILE, height: TILE },
  tileImg: { width: '100%', height: '100%' },
  tilePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', left: 6, bottom: 6,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeText: { color: '#fff', fontSize: 10.5, fontWeight: '700', marginLeft: 3 },
  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 14 },
  emptySub:   { fontSize: 13, marginTop: 6, textAlign: 'center' },
});
