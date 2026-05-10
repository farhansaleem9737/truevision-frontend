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
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import TopTabs                   from '../components/reel/TopTabs';
import ReelCard                  from '../components/reel/ReelCard';
import videoService              from '../services/VideoService';
import pixabayService            from '../services/pixabayService';

const { width, height } = Dimensions.get('window');
const TAB_BAR_BASE = 65;

const fmt = (n) => {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

// ─── Comment Sheet ───────────────────────────────────────────────────────────
const CommentSheet = ({ visible, onClose, videoId, commentCount = 0, isPexels = false }) => {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(height)).current;
  const [comments, setComments] = useState([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [count, setCount]       = useState(commentCount);
  const [likedMap, setLikedMap] = useState({});

  useEffect(() => setCount(commentCount), [commentCount]);

  // Load comments — only for our own videos. Pexels items have no comments in our DB.
  useEffect(() => {
    if (!visible) return;
    if (isPexels || !videoId) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    videoService.getComments(videoId, 1, 'new').then((res) => {
      if (res.success) setComments(res.comments || []);
      setLoading(false);
    });
  }, [visible, videoId, isPexels]);

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : height,
      useNativeDriver: true, friction: 26, tension: 240,
    }).start();
  }, [visible]);

  const post = useCallback(async () => {
    if (!text.trim() || !videoId || isPexels) {
      setText('');
      return;
    }
    const res = await videoService.addComment(videoId, text.trim());
    if (res.success && res.comment) {
      setComments(p => [res.comment, ...p]);
      setCount(n => n + 1);
    }
    setText('');
  }, [text, videoId, isPexels]);

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
              <View style={{ alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={42} color="#cbd5e1" />
                <Text style={{ color: '#475569', fontSize: 15, fontWeight: '700', marginTop: 14 }}>
                  Be the first to comment
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
                  {isPexels
                    ? 'Conversations on imported videos start here.'
                    : 'No comments yet — share your thoughts!'}
                </Text>
              </View>
            }
          />
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[S.cInputRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={S.cInputBox}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={isPexels ? 'Comments are read-only on imported videos' : 'Add a comment…'}
                placeholderTextColor="#94a3b8"
                style={S.cInput}
                returnKeyType="send"
                onSubmitEditing={post}
                editable={!isPexels}
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
//
// Interleave own videos into a Pexels-heavy stream. With ratio=4, every 5th
// slot (positions 0, 5, 10, …) is reserved for a user video; the rest is Pexels.
// When a side runs out, the other side fills the remaining slots.
const interleave = (own, pexels, ratio = 4) => {
  const out = [];
  let oi = 0, pi = 0, n = 0;
  while (oi < own.length || pi < pexels.length) {
    const slotForOwn = (n % (ratio + 1) === 0);
    if (slotForOwn && oi < own.length) {
      out.push(own[oi++]);
    } else if (pi < pexels.length) {
      out.push(pexels[pi++]);
    } else if (oi < own.length) {
      out.push(own[oi++]);
    }
    n++;
  }
  return out;
};

const tagOwn = (v) => ({ ...v, source: 'truevision' });
// External items already arrive from pixabayService with `source: 'pixabay'` set,
// so no extra tagging is required.

// ─── Following empty state ──────────────────────────────────────────────────
const FollowingEmpty = ({ insetTop }) => (
  <View style={[S.loadingFull, { paddingTop: insetTop }]}>
    <View style={S.emptyIconWrap}>
      <Ionicons name="people-outline" size={56} color="rgba(255,255,255,0.55)" />
    </View>
    <Text style={S.emptyTitle}>Follow creators to personalize your feed</Text>
    <Text style={S.emptySub}>
      Once you follow creators, their latest videos will appear here.
    </Text>
  </View>
);

// ─── Main HomeScreen ─────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const isFocused = useIsFocused();

  const [activeTab,    setActiveTab]    = useState('trending');
  const [activeIndex,  setActiveIndex]  = useState(0);
  const [showComments, setShowComments] = useState(false);

  const [feed, setFeed]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [pexelsPage, setPexelsPage]   = useState(1);
  const [pexelsHasMore, setPexelsHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pexelsError, setPexelsError] = useState(null);  // banner copy when pexels fetch fails

  const flatListRef = useRef(null);

  const tabOffset = TAB_BAR_BASE + (insets.bottom > 0 ? insets.bottom : Platform.select({ ios: 25, android: 10 }));

  // ── Load TRENDING feed: own (sort=trending) + curated Pixabay, interleaved ──
  const loadTrending = useCallback(async () => {
    console.log('[HomeScreen] loading trending feed (own + pixabay)…');
    const [ownRes, pxRes] = await Promise.all([
      videoService.getFeed(1, 8, 'trending'),
      pixabayService.getInformativeFeed(1),
    ]);

    const ownVids = ownRes.success ? (ownRes.videos || []).map(tagOwn) : [];
    const pxVids  = pxRes.success  ? (pxRes.items  || []) : [];

    console.log(`[HomeScreen] own videos: ${ownVids.length}`);
    console.log(`[HomeScreen] pixabay videos: ${pxVids.length} (success=${pxRes.success}${pxRes.error ? `, error=${pxRes.error}` : ''})`);
    if (pxVids.length) console.log(`[HomeScreen] sample pixabay url: ${pxVids[0]?.videoUrl}`);

    const merged = interleave(ownVids, pxVids, 4);
    console.log(`[HomeScreen] merged feed length: ${merged.length}`);

    setFeed(merged);
    setPexelsPage(1);
    setPexelsHasMore(pxRes.hasMore !== false);
    setPexelsError(pxRes.success ? null : (pxRes.error || 'Could not load curated feed'));
    setActiveIndex(0);
  }, []);

  // ── Load more pages — only Pixabay (own videos already loaded once) ──────
  const loadMorePexels = useCallback(async () => {
    if (loadingMore || !pexelsHasMore || activeTab !== 'trending') return;
    setLoadingMore(true);
    const next = pexelsPage + 1;
    console.log(`[HomeScreen] loading pixabay page ${next}…`);
    const pxRes = await pixabayService.getInformativeFeed(next);
    if (pxRes.success) {
      const more = pxRes.items || [];
      console.log(`[HomeScreen] +${more.length} pixabay items`);
      setFeed((prev) => {
        const seen = new Set(prev.map((p) => p.id || p._id));
        return [...prev, ...more.filter((m) => !seen.has(m.id))];
      });
      setPexelsPage(next);
      setPexelsHasMore(pxRes.hasMore !== false);
    } else {
      console.log(`[HomeScreen] pixabay page ${next} failed: ${pxRes.error}`);
      setPexelsHasMore(false);
    }
    setLoadingMore(false);
  }, [loadingMore, pexelsHasMore, pexelsPage, activeTab]);

  // ── Tab change ──────────────────────────────────────────────────────────
  useEffect(() => {
    setActiveIndex(0);
    setFeed([]);
    flatListRef.current?.scrollToOffset?.({ offset: 0, animated: false });

    if (activeTab === 'trending') {
      setLoading(true);
      loadTrending().finally(() => setLoading(false));
    } else {
      // Following — no follow infrastructure yet, render empty state directly.
      setLoading(false);
    }
  }, [activeTab, loadTrending]);

  // Refresh when screen regains focus (only for trending; following is static)
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'trending' && feed.length === 0 && !loading) {
        setLoading(true);
        loadTrending().finally(() => setLoading(false));
      }
    }, [activeTab, feed.length, loading, loadTrending]),
  );

  const onRefresh = useCallback(async () => {
    if (activeTab !== 'trending') return;
    setRefreshing(true);
    await loadTrending();
    setRefreshing(false);
  }, [activeTab, loadTrending]);

  // ── Viewability ─────────────────────────────────────────────────────────
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
      setShowComments(false);
    }
  }).current;
  const viewConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;

  // ── Hide a video (from "Not Interested" / "Hide" / "Report") ────────────
  const handleHide = useCallback((it /* , reason */) => {
    setFeed((prev) => prev.filter((v) => (v._id || v.id) !== (it._id || it.id)));
  }, []);

  // ── Render — same ReelCard for both own + Pexels ───────────────────────
  const renderItem = useCallback(({ item, index }) => {
    const isActive = index === activeIndex && !showComments;
    return (
      <ReelCard
        item={item}
        isActive={isActive}
        isFocused={isFocused}
        onOpenComments={() => setShowComments(true)}
        onHide={handleHide}
        bottomOffset={tabOffset}
      />
    );
  }, [activeIndex, showComments, isFocused, tabOffset, handleHide]);

  const keyExtractor = useCallback(
    (item) => item.id || item._id || String(Math.random()),
    [],
  );

  const activeItem = feed[activeIndex];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {activeTab === 'following' ? (
        <FollowingEmpty insetTop={insets.top + 60} />
      ) : loading && feed.length === 0 ? (
        <View style={S.loadingFull}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={S.loadingText}>Loading feed…</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={feed}
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
          onEndReached={loadMorePexels}
          onEndReachedThreshold={1.2}
          refreshing={refreshing}
          onRefresh={onRefresh}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={1}
          removeClippedSubviews={Platform.OS === 'android'}
          ListFooterComponent={
            loadingMore ? <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color="#fff" /></View> : null
          }
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

      <TopTabs
        active={activeTab}
        onChange={(tab) => { if (tab !== activeTab) setActiveTab(tab); }}
        style={{ top: insets.top + 10 }}
      />

      {/* Pexels-failed banner — slim, dismissible, sits below the tab row */}
      {activeTab === 'trending' && pexelsError ? (
        <View style={[S.banner, { top: insets.top + 56 }]}>
          <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
          <Text style={S.bannerText} numberOfLines={2}>{pexelsError}</Text>
          <TouchableOpacity
            onPress={() => { setLoading(true); loadTrending().finally(() => setLoading(false)); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={S.bannerRetry}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPexelsError(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginLeft: 8 }}
          >
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>
      ) : null}

      <CommentSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        videoId={activeItem?._id || activeItem?.id}
        commentCount={activeItem?.commentsCount ?? activeItem?.comments ?? 0}
        isPexels={activeItem?.source === 'pexels'}
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

  banner: {
    position: 'absolute', left: 14, right: 14,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9,
    zIndex: 60,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  bannerText: {
    flex: 1, color: '#fff', fontSize: 12.5, fontWeight: '600',
    marginLeft: 8, marginRight: 8,
  },
  bannerRetry: {
    color: '#60a5fa', fontWeight: '800', fontSize: 12.5,
  },

  emptyIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    color: '#fff', fontSize: 17, fontWeight: '700',
    textAlign: 'center', paddingHorizontal: 36,
  },
  emptySub: {
    color: 'rgba(255,255,255,0.55)', fontSize: 13.5,
    textAlign: 'center', marginTop: 8, paddingHorizontal: 48, lineHeight: 19,
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
