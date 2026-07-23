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
  View, Text, FlatList, TouchableOpacity,
  StatusBar, Dimensions, Platform, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons }              from '@expo/vector-icons';
import { useSafeAreaInsets }     from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import TopTabs                   from '../components/reel/TopTabs';
import ReelCard                  from '../components/reel/ReelCard';
import CommentsSheet             from '../components/comments/CommentsSheet';
import videoService              from '../services/VideoService';
import pixabayService            from '../services/pixabayService';
import usePreferences            from '../hooks/usePreferences';
import useReelPrefetch           from '../hooks/useReelPrefetch';
import { onFeedRefresh }         from '../services/feedEvents';

const { height } = Dimensions.get('window');
const TAB_BAR_BASE = 65;

// ─── Helpers ─────────────────────────────────────────────────────────────────
//
// Interleave own videos into an external-heavy stream. With ratio=4, every 5th
// slot (positions 0, 5, 10, …) is reserved for a user video; the rest is the
// external source. When a side runs out, the other side fills the remaining slots.
const interleave = (own, external, ratio = 4) => {
  const out = [];
  let oi = 0, ei = 0, n = 0;
  while (oi < own.length || ei < external.length) {
    const slotForOwn = (n % (ratio + 1) === 0);
    if (slotForOwn && oi < own.length) {
      out.push(own[oi++]);
    } else if (ei < external.length) {
      out.push(external[ei++]);
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
  const { prefs } = usePreferences();
  // Personalized "For You" when enabled; generic trending otherwise (spec).
  const feedSort = prefs?.content?.personalizedRecs !== false ? 'foryou' : 'trending';

  const [activeTab,    setActiveTab]    = useState('trending');
  const [activeIndex,  setActiveIndex]  = useState(0);
  const [showComments, setShowComments] = useState(false);

  const [feed, setFeed]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [externalPage, setExternalPage]       = useState(1);
  const [externalHasMore, setExternalHasMore] = useState(true);
  const [loadingMore, setLoadingMore]         = useState(false);

  // Following-tab pagination (independent from the trending/external pager).
  const [followingPage, setFollowingPage]       = useState(1);
  const [followingHasMore, setFollowingHasMore] = useState(true);

  // Smart preload: warm the next 1-2 videos (files) + upcoming thumbnails so
  // playback starts instantly on swipe. No-op on empty feed.
  useReelPrefetch(feed, activeIndex);
  const [externalError, setExternalError]     = useState(null);  // banner copy when external-feed fetch fails

  const flatListRef = useRef(null);

  const tabOffset = TAB_BAR_BASE + (insets.bottom > 0 ? insets.bottom : Platform.select({ ios: 25, android: 10 }));

  // ── Load TRENDING feed: own (sort=trending) + curated Pixabay, interleaved ──
  const loadTrending = useCallback(async () => {
    console.log(`[HomeScreen] loading feed (sort=${feedSort}) + pixabay…`);
    const [ownRes, pxRes] = await Promise.all([
      videoService.getFeed(1, 8, feedSort),
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
    setExternalPage(1);
    setExternalHasMore(pxRes.hasMore !== false);
    setExternalError(pxRes.success ? null : (pxRes.error || 'Could not load curated feed'));
    setActiveIndex(0);
  }, [feedSort]);

  // ── Load more pages — only external (own videos already loaded once) ────
  const loadMoreExternal = useCallback(async () => {
    if (loadingMore || !externalHasMore || activeTab !== 'trending') return;
    setLoadingMore(true);
    const next = externalPage + 1;
    console.log(`[HomeScreen] loading pixabay page ${next}…`);
    const pxRes = await pixabayService.getInformativeFeed(next);
    if (pxRes.success) {
      const more = pxRes.items || [];
      console.log(`[HomeScreen] +${more.length} pixabay items`);
      setFeed((prev) => {
        const seen = new Set(prev.map((p) => p.id || p._id));
        return [...prev, ...more.filter((m) => !seen.has(m.id))];
      });
      setExternalPage(next);
      setExternalHasMore(pxRes.hasMore !== false);
    } else {
      console.log(`[HomeScreen] pixabay page ${next} failed: ${pxRes.error}`);
      setExternalHasMore(false);
    }
    setLoadingMore(false);
  }, [loadingMore, externalHasMore, externalPage, activeTab]);

  // ── Load FOLLOWING feed: videos from creators the user follows ──────────
  // Real backend feed (GET /videos/following) — newest first, followed users
  // only, reflects follow/unfollow immediately. Page 1 (reset).
  const loadFollowing = useCallback(async () => {
    const res = await videoService.getFollowingFeed(1, 8);
    if (res.success) {
      setFeed((res.videos || []).map(tagOwn));           // all TrueVision uploads
      setFollowingPage(1);
      setFollowingHasMore(1 < (res.pagination?.pages || 1));
    } else {
      setFeed([]);
      setFollowingHasMore(false);
    }
    setActiveIndex(0);
  }, []);

  // Following infinite scroll — append the next page, de-duped.
  const loadMoreFollowing = useCallback(async () => {
    if (loadingMore || !followingHasMore || activeTab !== 'following') return;
    setLoadingMore(true);
    const next = followingPage + 1;
    const res = await videoService.getFollowingFeed(next, 8);
    if (res.success) {
      const more = (res.videos || []).map(tagOwn);
      setFeed((prev) => {
        const seen = new Set(prev.map((p) => p.id || p._id));
        return [...prev, ...more.filter((m) => !seen.has(m.id || m._id))];
      });
      setFollowingPage(next);
      setFollowingHasMore(next < (res.pagination?.pages || 1));
    } else {
      setFollowingHasMore(false);
    }
    setLoadingMore(false);
  }, [loadingMore, followingHasMore, followingPage, activeTab]);

  // ── Tab change ──────────────────────────────────────────────────────────
  useEffect(() => {
    setActiveIndex(0);
    setFeed([]);
    flatListRef.current?.scrollToOffset?.({ offset: 0, animated: false });

    setLoading(true);
    if (activeTab === 'trending') {
      loadTrending().finally(() => setLoading(false));
    } else {
      setFollowingPage(1);
      setFollowingHasMore(true);
      loadFollowing().finally(() => setLoading(false));
    }
  }, [activeTab, loadTrending, loadFollowing]);

  // Refresh when the screen regains focus so returning to the app shows fresh
  // content (spec: "Refresh automatically when returning to the app"). Reloads
  // whichever tab is active when its feed is empty.
  useFocusEffect(
    useCallback(() => {
      if (feed.length !== 0 || loading) return;
      setLoading(true);
      const load = activeTab === 'trending' ? loadTrending : loadFollowing;
      load().finally(() => setLoading(false));
    }, [activeTab, feed.length, loading, loadTrending, loadFollowing]),
  );

  // Auto-refresh when the user changes a recommendation setting elsewhere.
  // usePreferences fires this ONLY after the backend confirmed success (and
  // therefore already cleared this user's feed cache), so the refetch below is
  // guaranteed to return fresh recommendations — no manual pull-to-refresh.
  useEffect(() => {
    const off = onFeedRefresh(() => {
      if (activeTab !== 'trending') return;
      setLoading(true);
      loadTrending().finally(() => setLoading(false));
    });
    return off;
  }, [activeTab, loadTrending]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'trending') await loadTrending();
    else                         await loadFollowing();
    setRefreshing(false);
  }, [activeTab, loadTrending, loadFollowing]);

  // Route infinite-scroll to the active tab's pager.
  const handleEndReached = useCallback(() => {
    if (activeTab === 'trending') loadMoreExternal();
    else                         loadMoreFollowing();
  }, [activeTab, loadMoreExternal, loadMoreFollowing]);

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

  // ── Render — same ReelCard for both own + external sources ────────────
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

      {loading && feed.length === 0 ? (
        <View style={S.loadingFull}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={S.loadingText}>Loading feed…</Text>
        </View>
      ) : activeTab === 'following' && feed.length === 0 ? (
        <FollowingEmpty insetTop={insets.top + 60} />
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
          onEndReached={handleEndReached}
          onEndReachedThreshold={1.2}
          refreshing={refreshing}
          onRefresh={onRefresh}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={1}
          updateCellsBatchingPeriod={50}
          disableIntervalMomentum
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

      {/* External-feed failure banner — slim, dismissible, sits below the tab row */}
      {activeTab === 'trending' && externalError ? (
        <View style={[S.banner, { top: insets.top + 56 }]}>
          <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
          <Text style={S.bannerText} numberOfLines={2}>{externalError}</Text>
          <TouchableOpacity
            onPress={() => { setLoading(true); loadTrending().finally(() => setLoading(false)); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={S.bannerRetry}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setExternalError(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginLeft: 8 }}
          >
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>
      ) : null}

      <CommentsSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        videoId={activeItem?._id || activeItem?.id}
        commentCount={activeItem?.commentsCount ?? activeItem?.comments ?? 0}
        isExternal={!!activeItem?.source && activeItem.source !== 'truevision'}
        allowComments={activeItem?.allowComments !== false}
        tabOffset={tabOffset}
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

});
