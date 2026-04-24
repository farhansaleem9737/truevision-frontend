// screens/HomeScreen.js  —  TrueVision Reel Feed
//
// Combines TikTok "Following / Friends" tabs with
// Instagram Reels compact premium layout.
//
// Features:
//  • Full-screen vertical swipe feed (pagingEnabled FlatList)
//  • Auto-play visible video, pause hidden ones
//  • Double-tap to like with heart burst
//  • Tap to pause/play
//  • Real API feed via VideoService
//  • Comment bottom sheet
//  • Optimized: windowSize 3, maxToRenderPerBatch 2, getItemLayout

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TouchableWithoutFeedback,
  Image, TextInput, KeyboardAvoidingView, Animated,
  StatusBar, Dimensions, Platform, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons }              from '@expo/vector-icons';
import { useSafeAreaInsets }     from 'react-native-safe-area-context';
import { useFocusEffect }       from '@react-navigation/native';
import TopTabs                   from '../components/reel/TopTabs';
import ReelCard                  from '../components/reel/ReelCard';
import videoService              from '../services/VideoService';

const { width, height } = Dimensions.get('window');
const TAB_BAR_BASE = 65;

const fmt = (n) => {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

// ─── Comment Sheet ───────────────────────────────────────────────────────────
const CommentSheet = ({ visible, onClose, videoId, commentCount = 0 }) => {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(height)).current;
  const [comments, setComments] = useState([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [count, setCount]       = useState(commentCount);
  const [likedMap, setLikedMap] = useState({});

  useEffect(() => setCount(commentCount), [commentCount]);

  // Load real comments
  useEffect(() => {
    if (visible && videoId) {
      setLoading(true);
      videoService.getComments(videoId, 1, 'new').then((res) => {
        if (res.success) setComments(res.comments || []);
        setLoading(false);
      });
    }
  }, [visible, videoId]);

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : height,
      useNativeDriver: true, friction: 26, tension: 240,
    }).start();
  }, [visible]);

  const post = useCallback(async () => {
    if (!text.trim() || !videoId) return;
    const res = await videoService.addComment(videoId, text.trim());
    if (res.success && res.comment) {
      setComments(p => [res.comment, ...p]);
      setCount(n => n + 1);
    }
    setText('');
  }, [text, videoId]);

  const tabOffset = TAB_BAR_BASE + (insets.bottom > 0 ? insets.bottom : Platform.select({ ios: 25, android: 10 }));

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
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 8 }}
            renderItem={({ item }) => {
              const u = item.userId || item.user || {};
              const cId = item._id || item.id;
              return (
                <View style={S.cRow}>
                  <Image source={{ uri: u.profileImage || u.avatar || 'https://i.pravatar.cc/150?img=10' }} style={S.cAvatar} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={S.cUser}>{u.username || u.name || 'user'}</Text>
                    </View>
                    <Text style={S.cText}>{item.text || item.content || ''}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setLikedMap(m => ({ ...m, [cId]: !m[cId] }));
                        videoService.toggleCommentLike(videoId, cId);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}
                    >
                      <Ionicons
                        name={likedMap[cId] ? 'heart' : 'heart-outline'}
                        size={13}
                        color={likedMap[cId] ? '#e11d48' : '#94a3b8'}
                      />
                      <Text style={S.cLikes}>{fmt((item.likesCount || item.likes || 0) + (likedMap[cId] ? 1 : 0))}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', color: '#94a3b8', paddingTop: 40 }}>No comments yet</Text>
            }
          />
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[S.cInputRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={S.cInputBox}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Add a comment…"
                placeholderTextColor="#94a3b8"
                style={S.cInput}
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

// ─── Main HomeScreen ─────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [activeTab,    setActiveTab]    = useState('following');
  const [activeIndex,  setActiveIndex]  = useState(0);
  const [showComments, setShowComments] = useState(false);

  // Feed state
  const [feed, setFeed]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const flatListRef = useRef(null);

  const tabOffset = TAB_BAR_BASE + (insets.bottom > 0 ? insets.bottom : Platform.select({ ios: 25, android: 10 }));

  // ── Load feed from API ─────────────────────────────────────────────────
  const loadFeed = useCallback(async (p = 1, replace = true) => {
    const sort = activeTab === 'following' ? 'new' : 'trending';
    const res = await videoService.getFeed(p, 8, sort);
    if (res.success) {
      const vids = res.videos || [];
      if (replace) setFeed(vids);
      else setFeed(prev => [...prev, ...vids]);
      setHasMore(vids.length >= 8);
      setPage(p);
    }
    setLoading(false);
    setRefreshing(false);
  }, [activeTab]);

  // Load on mount and tab change
  useEffect(() => {
    setLoading(true);
    setActiveIndex(0);
    setFeed([]);
    loadFeed(1, true);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeTab]);

  // Refresh when screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (feed.length === 0) loadFeed(1, true);
    }, [feed.length, loadFeed]),
  );

  // ── Pagination ─────────────────────────────────────────────────────────
  const loadMore = () => {
    if (!hasMore || loading) return;
    loadFeed(page + 1, false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFeed(1, true);
  };

  // ── Viewability ────────────────────────────────────────────────────────
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
      setShowComments(false);
    }
  }).current;
  const viewConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;

  // ── Tab switch ─────────────────────────────────────────────────────────
  const handleTabSwitch = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Loading state */}
      {loading && feed.length === 0 ? (
        <View style={S.loadingFull}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={S.loadingText}>Loading feed…</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={feed}
          keyExtractor={(item) => item._id || item.id || String(Math.random())}
          renderItem={({ item, index }) => (
            <ReelCard
              item={item}
              isActive={index === activeIndex && !showComments}
              onOpenComments={() => setShowComments(true)}
              bottomOffset={tabOffset}
            />
          )}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewConfig}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          scrollEnabled={!showComments}
          onEndReached={loadMore}
          onEndReachedThreshold={1.5}
          refreshing={refreshing}
          onRefresh={onRefresh}
          // Performance
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={1}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            !loading ? (
              <View style={[S.loadingFull, { height }]}>
                <Ionicons name="videocam-off-outline" size={56} color="rgba(255,255,255,0.3)" />
                <Text style={S.loadingText}>No videos yet</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                  Pull down to refresh
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* ── Floating tabs ─────────────────────────────────────────────── */}
      <TopTabs
        active={activeTab}
        onChange={handleTabSwitch}
        style={{ top: insets.top + 10 }}
      />

      {/* ── Comment sheet ─────────────────────────────────────────────── */}
      <CommentSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        videoId={feed[activeIndex]?._id || feed[activeIndex]?.id}
        commentCount={feed[activeIndex]?.commentsCount ?? feed[activeIndex]?.comments ?? 0}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  loadingFull: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 14,
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

  cRow:     { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 14, marginBottom: 4 },
  cAvatar:  { width: 34, height: 34, borderRadius: 17, marginRight: 12, backgroundColor: '#e2e8f0' },
  cUser:    { color: '#0f172a', fontSize: 13, fontWeight: '700' },
  cText:    { color: '#334155', fontSize: 14, lineHeight: 20 },
  cLikes:   { color: '#94a3b8', fontSize: 11, marginLeft: 4 },

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
