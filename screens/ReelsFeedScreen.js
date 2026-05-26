// truevision/screens/ReelsFeedScreen.js
//
// In-app reel viewer used when the user taps a tile from Profile or Discover.
// Uses the SAME ReelCard component as the Home tab so the layout, action
// column, three-dot menu and gestures are identical. Lives inside each tab's
// stack — that's what keeps the bottom tab bar visible (the one architectural
// difference from the legacy `VideoPlayer` route).
//
// Route params:
//   videos:       Video[]   — full list to scroll through
//   initialIndex: number    — which item to open on first paint

import { useCallback, useRef, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StatusBar,
  Platform, StyleSheet, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused }      from '@react-navigation/native';
import { Ionicons }          from '@expo/vector-icons';
import ReelCard              from '../components/reel/ReelCard';
import CommentsSheet         from '../components/comments/CommentsSheet';

const { height } = Dimensions.get('window');
// Must match the BottomTabNavigator tab-bar height so the action column / caption
// sit just above the (still-visible) tab bar — same as the Home tab.
const TAB_BAR_BASE = 65;

// ─── Main ────────────────────────────────────────────────────────────────────
export default function ReelsFeedScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const params = route?.params || {};
  const incoming = Array.isArray(params.videos) ? params.videos : [];
  const requestedIndex = Number.isInteger(params.initialIndex) ? params.initialIndex : 0;

  // Local list (so hide/delete in MoreSheet can mutate it)
  const [videos, setVideos] = useState(incoming);
  const [showComments, setShowComments] = useState(false);

  const safeInitial = Math.min(
    Math.max(0, requestedIndex),
    Math.max(0, videos.length - 1),
  );
  const [activeIndex, setActiveIndex] = useState(safeInitial);

  const flatListRef = useRef(null);

  // Tab bar offset — matches the Home tab so the action column sits in the same place.
  const tabOffset = TAB_BAR_BASE + (insets.bottom > 0 ? insets.bottom : Platform.select({ ios: 25, android: 10 }));

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
      setShowComments(false);
    }
  }).current;
  const viewConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;

  const handleHide = useCallback((it /* , reason */) => {
    setVideos((prev) => {
      const next = prev.filter((v) => (v._id || v.id) !== (it._id || it.id));
      // If we removed the last video, pop back so user isn't stuck on a black screen
      if (!next.length) navigation.goBack();
      return next;
    });
  }, [navigation]);

  const renderItem = useCallback(({ item, index }) => (
    <ReelCard
      item={item}
      isActive={index === activeIndex && !showComments}
      isFocused={isFocused}
      onOpenComments={() => setShowComments(true)}
      onHide={handleHide}
      bottomOffset={tabOffset}
    />
  ), [activeIndex, showComments, isFocused, tabOffset, handleHide]);

  const keyExtractor = useCallback(
    (item, i) => item?._id || item?.id || `idx-${i}`,
    [],
  );

  const activeItem = videos[activeIndex];

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <FlatList
        ref={flatListRef}
        data={videos}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
        scrollEnabled={!showComments}
        // Open exactly on the tapped tile.
        initialScrollIndex={safeInitial}
        initialNumToRender={Math.max(safeInitial + 1, 1)}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToOffset?.({ offset: height * info.index, animated: false });
        }}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* Back button overlay */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
        hitSlop={S.hit}
        style={[S.backBtn, { top: insets.top + 8 }]}
      >
        <Ionicons name="chevron-back" size={26} color="#fff" />
      </TouchableOpacity>

      <CommentsSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        videoId={activeItem?._id || activeItem?.id}
        commentCount={activeItem?.commentsCount ?? activeItem?.comments ?? 0}
        isExternal={!!activeItem?.source && activeItem.source !== 'truevision'}
        tabOffset={tabOffset}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  hit:  { top: 10, bottom: 10, left: 10, right: 10 },

  backBtn: {
    position: 'absolute', left: 14,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 30,
  },

});
