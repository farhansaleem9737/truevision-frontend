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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StatusBar,
  Animated, Image, TextInput, KeyboardAvoidingView, Platform,
  StyleSheet, Dimensions, ActivityIndicator, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused }      from '@react-navigation/native';
import { Ionicons }          from '@expo/vector-icons';
import ReelCard              from '../components/reel/ReelCard';
import videoService          from '../services/VideoService';

const { height } = Dimensions.get('window');
// Must match the BottomTabNavigator tab-bar height so the action column / caption
// sit just above the (still-visible) tab bar — same as the Home tab.
const TAB_BAR_BASE = 65;

// ─── Comment Sheet (compact copy of HomeScreen's sheet) ─────────────────────
const fmt = (n) => {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const CommentSheet = ({ visible, onClose, videoId, commentCount = 0, isPexels = false, tabOffset }) => {
  const insets  = useSafeAreaInsets();
  const slideY  = useRef(new Animated.Value(height)).current;
  const [comments, setComments] = useState([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [count, setCount]       = useState(commentCount);

  useEffect(() => setCount(commentCount), [commentCount]);

  // Slide animation in/out
  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : height,
      useNativeDriver: true, friction: 26, tension: 240,
    }).start();
  }, [visible]);

  // Load comments when sheet opens (own videos only)
  useEffect(() => {
    if (!visible) return;
    if (isPexels || !videoId) { setComments([]); return; }
    setLoading(true);
    videoService.getComments(videoId, 1, 'new').then((res) => {
      if (res.success) setComments(res.comments || []);
      setLoading(false);
    });
  }, [visible, videoId, isPexels]);

  const post = async () => {
    if (!text.trim() || !videoId || isPexels) { setText(''); return; }
    const res = await videoService.addComment(videoId, text.trim());
    if (res.success && res.comment) {
      setComments((p) => [res.comment, ...p]);
      setCount((n) => n + 1);
    }
    setText('');
  };

  return (
    <>
      {visible && (
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={S.sheetBackdrop} />
        </TouchableWithoutFeedback>
      )}
      <Animated.View style={[S.sheet, { bottom: tabOffset, transform: [{ translateY: slideY }] }]}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={S.sheetHandle} />
        </View>
        <View style={S.sheetHeader}>
          <Text style={S.sheetTitle}>Comments</Text>
          <Text style={S.sheetCount}>{fmt(count)}</Text>
          <TouchableOpacity onPress={onClose} style={{ marginLeft: 'auto' }}>
            <Ionicons name="close" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>
        <View style={S.sheetDivider} />

        {loading ? (
          <ActivityIndicator style={{ paddingTop: 40 }} color="#3b82f6" />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item._id || String(Math.random())}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 8 }}
            renderItem={({ item }) => {
              const u = item.userId || item.user || {};
              return (
                <View style={S.cRow}>
                  <Image source={{ uri: u.profileImage || u.avatar || 'https://i.pravatar.cc/150?img=10' }} style={S.cAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={S.cUser}>{u.username || u.name || 'user'}</Text>
                    <Text style={S.cText}>{item.text || item.content || ''}</Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={42} color="#cbd5e1" />
                <Text style={{ color: '#475569', fontSize: 15, fontWeight: '700', marginTop: 14 }}>
                  Be the first to comment
                </Text>
              </View>
            }
          />
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[S.cInputRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={S.cInputBox}>
              <TextInput
                value={text} onChangeText={setText}
                placeholder={isPexels ? 'Comments are read-only on imported videos' : 'Add a comment…'}
                placeholderTextColor="#94a3b8"
                style={S.cInput}
                editable={!isPexels}
                returnKeyType="send"
                onSubmitEditing={post}
              />
              {text.trim().length > 0 && (
                <TouchableOpacity onPress={post}>
                  <Text style={S.cPostBtn}>Post</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </>
  );
};

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

      <CommentSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        videoId={activeItem?._id || activeItem?.id}
        commentCount={activeItem?.commentsCount ?? activeItem?.comments ?? 0}
        isPexels={activeItem?.source === 'pexels'}
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

  // Comment sheet
  sheetBackdrop: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50,
  },
  sheet: {
    position: 'absolute', left: 0, right: 0,
    height: height * 0.65,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    zIndex: 100,
  },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1', marginBottom: 4 },
  sheetHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  sheetTitle:   { color: '#0f172a', fontWeight: '800', fontSize: 16 },
  sheetCount:   { color: '#64748b', fontWeight: '600', fontSize: 14, marginLeft: 8 },
  sheetDivider: { height: 1, backgroundColor: '#f1f5f9' },

  cRow:    { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 14, marginBottom: 4 },
  cAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 12, backgroundColor: '#e2e8f0' },
  cUser:   { color: '#0f172a', fontSize: 13, fontWeight: '700' },
  cText:   { color: '#334155', fontSize: 14, lineHeight: 20 },

  cInputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fff',
  },
  cInputBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f1f5f9', borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  cInput:   { flex: 1, color: '#0f172a', fontSize: 14 },
  cPostBtn: { color: '#3b82f6', fontWeight: '800', fontSize: 14 },
});
