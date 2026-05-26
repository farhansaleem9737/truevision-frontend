// truevision/screens/ProfileScreen.js
//
// Instagram-inspired Profile screen.
// • Minimal white header with notification + 3-dot icons
// • Avatar with gradient ring (Instagram style)
// • Name, @username, location
// • Three stats: Videos / Followers / Following
// • Tab switcher: 3-col grid (default) | reels (placeholder)
// • Pull-to-refresh, view-count badge per thumbnail
//
// State machine: 'loading' | 'ready' | 'error'
// On error, the UI surfaces the actual failure reason (URL, userId, message)
// so debugging from the device requires no console access.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StatusBar, StyleSheet, Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets }  from 'react-native-safe-area-context';
import { useFocusEffect }     from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient }     from 'expo-linear-gradient';
import { Ionicons }           from '@expo/vector-icons';
import { useAuth }            from '../context/AuthContext';
import { useTheme }           from '../context/ThemeContext';
import userService            from '../services/UserService';
import videoService           from '../services/VideoService';
import { API_URL }            from '../services/config';
import MoreOptionsSheet       from '../components/profile/MoreOptionsSheet';
import VideoActionsSheet      from '../components/profile/VideoActionsSheet';

const { width } = Dimensions.get('window');
const GRID_GAP  = 2;
const COL_COUNT = 3;
const TILE      = (width - GRID_GAP * (COL_COUNT - 1)) / COL_COUNT;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtCount = (n) => {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};
const initials = (name) =>
  name ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) : '?';

// ─── Avatar with gradient ring ───────────────────────────────────────────────
const AvatarRing = ({ uri, name, size = 100 }) => (
  <LinearGradient
    colors={['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5']}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    style={[S.ringOuter, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}
  >
    <View style={[S.ringInner, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}>
      {uri ? (
        <ExpoImage
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[S.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[S.avatarInitials, { fontSize: size * 0.34 }]}>{initials(name)}</Text>
        </View>
      )}
    </View>
  </LinearGradient>
);

const Stat = ({ value, label, colors }) => (
  <View style={S.stat}>
    <Text style={[S.statValue, colors && { color: colors.text }]}>{fmtCount(value)}</Text>
    <Text style={[S.statLabel, colors && { color: colors.textMuted }]}>{label}</Text>
  </View>
);

// ─── Video tile (memoised) ───────────────────────────────────────────────────
const VideoTile = ({ video, onPress, onLongPress, showRepostBadge }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    onLongPress={onLongPress}
    delayLongPress={350}
    style={S.tile}
  >
    {video.thumbnailUrl ? (
      <ExpoImage
        source={{ uri: video.thumbnailUrl }}
        style={S.tileImg}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
        placeholderContentFit="cover"
      />
    ) : (
      <View style={[S.tileImg, S.tilePlaceholder]}>
        <Ionicons name="videocam-outline" size={22} color="rgba(15,23,42,0.35)" />
      </View>
    )}
    {video.pinned ? (
      <View style={S.pinBadge}>
        <Ionicons name="pin" size={11} color="#fff" />
      </View>
    ) : null}
    {showRepostBadge ? (
      <View style={S.repostBadge}>
        <Ionicons name="repeat" size={12} color="#fff" />
      </View>
    ) : null}
    <View style={S.tileViews}>
      <Ionicons name="eye-outline" size={11} color="#fff" />
      <Text style={S.tileViewsText}>{fmtCount(video.viewsCount)}</Text>
    </View>
  </TouchableOpacity>
);

// ─── Skeleton tile while loading ─────────────────────────────────────────────
const SkeletonTile = () => <View style={[S.tile, S.skel]} />;
const SKELETON_DATA = Array.from({ length: 9 }, (_, i) => ({ _id: `skel-${i}` }));

// ─── Main ────────────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user: authUser, logout, updateUser } = useAuth();

  const [user, setUser]             = useState(authUser);
  const [videos, setVideos]         = useState([]);
  const [reposts, setReposts]       = useState([]);
  const [activeTab, setActiveTab]   = useState('grid');     // 'grid' | 'reposted'
  const [phase, setPhase]           = useState('loading');  // 'loading' | 'ready' | 'error'
  const [errorInfo, setErrorInfo]   = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showMore, setShowMore]     = useState(false);
  const [actionsVideo, setActionsVideo] = useState(null); // long-pressed tile
  const [repostsLoaded, setRepostsLoaded] = useState(false);
  const [repostsLoading, setRepostsLoading] = useState(false);

  // Cancel-tracking for in-flight loads
  const inFlightToken = useRef(0);

  // ── Load profile + videos ──────────────────────────────────────────────
  const loadProfile = useCallback(async ({ isRefresh = false } = {}) => {
    // Tolerate either `_id` (post-fix) or `id` (older sessions) until everyone
    // has logged in again. AuthContext also normalises this on next app start.
    const userId = authUser?._id || authUser?.id;
    const url    = `${API_URL}/videos/user/${userId || '<missing>'}`;

    if (!userId) {
      console.log('[ProfileScreen] aborting — no authUser._id');
      setPhase('error');
      setErrorInfo({ url, userId: '(none)', message: 'Not signed in.' });
      return;
    }

    const myToken = ++inFlightToken.current;

    if (!isRefresh) setPhase('loading');
    setErrorInfo(null);

    console.log('[ProfileScreen] ─────────────────────────');
    console.log('[ProfileScreen] currentUser._id:', userId);
    console.log('[ProfileScreen] API_URL:        ', API_URL);
    console.log('[ProfileScreen] fetching:       ', url);

    let meRes, vidsRes;
    try {
      [meRes, vidsRes] = await Promise.all([
        userService.getMe(),
        videoService.getUserVideos(userId, 1, 30),
      ]);
    } catch (err) {
      console.log('[ProfileScreen] thrown error:', err.message);
      if (myToken !== inFlightToken.current) return;
      setPhase('error');
      setErrorInfo({ url, userId, message: err.message || 'Network error' });
      setRefreshing(false);
      return;
    }

    if (myToken !== inFlightToken.current) {
      console.log('[ProfileScreen] response stale, ignoring');
      return;
    }

    console.log('[ProfileScreen] /me           →', meRes.success, '| totalVideos=', meRes.user?.totalVideos);
    console.log('[ProfileScreen] /user/:userId →', vidsRes.success, '| count=', vidsRes.videos?.length, '| msg=', vidsRes.message || '-');

    if (meRes.success && meRes.user) {
      setUser(meRes.user);
      updateUser?.(meRes.user);
    }

    if (vidsRes.success) {
      const list = Array.isArray(vidsRes.videos) ? vidsRes.videos : [];
      console.log('[ProfileScreen] render ids:', list.map((v) => v._id).join(', ') || '(none)');
      setVideos(list);
      setPhase('ready');
      console.log('[ProfileScreen] phase = ready');
    } else {
      setPhase('error');
      setErrorInfo({ url, userId, message: vidsRes.message || 'Could not load your videos' });
    }

    setRefreshing(false);
  }, [authUser?._id, authUser?.id, updateUser]);

  // Stable ref so callbacks always get the latest function without re-binding effects.
  const loadRef = useRef(loadProfile);
  loadRef.current = loadProfile;

  const effectiveUserId = authUser?._id || authUser?.id;

  // First load when auth is ready
  useEffect(() => {
    if (effectiveUserId) loadRef.current();
  }, [effectiveUserId]);

  // Reload on focus (covers coming back from EditProfile / Upload).
  // Also refresh reposts so any taps in the feed since last open are reflected.
  useFocusEffect(
    useCallback(() => {
      if (effectiveUserId) {
        loadRef.current();
        if (repostsLoaded) loadReposts();
      }
    }, [effectiveUserId, repostsLoaded, loadReposts]),
  );

  // ── Reposts loader ─────────────────────────────────────────────────────
  const loadReposts = useCallback(async () => {
    const userId = authUser?._id || authUser?.id;
    if (!userId) return;
    setRepostsLoading(true);
    const res = await videoService.getUserReposts(userId, 1, 30);
    if (res.success) {
      setReposts(Array.isArray(res.videos) ? res.videos : []);
      setRepostsLoaded(true);
    } else {
      setReposts([]);
      setRepostsLoaded(true);
    }
    setRepostsLoading(false);
  }, [authUser?._id, authUser?.id]);

  // Lazy-load reposts the first time the tab is opened, and refresh on focus.
  useEffect(() => {
    if (activeTab === 'reposted' && !repostsLoaded) loadReposts();
  }, [activeTab, repostsLoaded, loadReposts]);

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'reposted') {
      loadReposts().finally(() => setRefreshing(false));
    } else {
      loadRef.current({ isRefresh: true });
    }
  };

  // ── Long-press tile → open modern Pin / Delete sheet ────────────────────
  const handleTileLongPress = (video) => setActionsVideo(video);

  const handlePinAction = async () => {
    const video = actionsVideo;
    if (!video) return;
    const isPinned = !!video.pinned;
    setVideos((prev) => prev.map((v) => v._id === video._id ? { ...v, pinned: !isPinned } : v));
    const res = await videoService.togglePin(video._id, !isPinned);
    if (!res.success) {
      setVideos((prev) => prev.map((v) => v._id === video._id ? { ...v, pinned: isPinned } : v));
      Alert.alert('Could not update pin', res.message || 'Try again later.');
    } else {
      loadRef.current();
    }
  };

  const handleDeleteAction = async () => {
    const video = actionsVideo;
    if (!video) return;
    setVideos((prev) => prev.filter((v) => v._id !== video._id));
    const res = await videoService.deleteVideo(video._id);
    if (!res.success) {
      Alert.alert('Delete failed', res.message || 'Try again later.');
      loadRef.current();
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────
  const totalVideos    = (user?.totalVideos != null) ? user.totalVideos : videos.length;
  const followersCount = user?.followersCount ?? 0;
  const followingCount = user?.followingCount ?? 0;

  // ── Header (renders inside FlatList so it scrolls with the grid) ────────
  const renderHeader = useCallback(() => (
    <View>
      <View style={S.profileBlock}>
        <AvatarRing uri={user?.profileImage} name={user?.fullName} size={104} />
        <Text style={[S.fullName, { color: colors.text }]} numberOfLines={1}>{user?.fullName || 'Your name'}</Text>
        <Text style={[S.username, { color: colors.textMuted }]}>@{user?.username || 'username'}</Text>
        {user?.country ? (
          <View style={S.locRow}>
            <Ionicons name="location" size={12} color={colors.textMuted} />
            <Text style={[S.locText, { color: colors.textMuted }]}>{user.country}</Text>
          </View>
        ) : null}
      </View>

      <View style={S.statsRow}>
        <Stat value={totalVideos}    label="Videos"    colors={colors} />
        <Stat value={followersCount} label="Followers" colors={colors} />
        <Stat value={followingCount} label="Following" colors={colors} />
      </View>

      <View style={[S.tabsRow, { borderTopColor: colors.divider }]}>
        <TouchableOpacity
          style={[S.tab, activeTab === 'grid' && { borderBottomColor: colors.text }]}
          onPress={() => setActiveTab('grid')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'grid' ? 'grid' : 'grid-outline'}
            size={22}
            color={activeTab === 'grid' ? colors.text : colors.textDim}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[S.tab, activeTab === 'reposted' && { borderBottomColor: colors.text }]}
          onPress={() => setActiveTab('reposted')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="repeat"
            size={24}
            color={activeTab === 'reposted' ? colors.text : colors.textDim}
          />
        </TouchableOpacity>
      </View>
    </View>
  ), [user, totalVideos, followersCount, followingCount, activeTab, colors]);

  // ── Render the body based on state machine ─────────────────────────────
  const renderItem = useCallback(({ item, index }) => (
    <VideoTile
      video={item}
      onPress={() => {
        const list = activeTab === 'reposted' ? reposts : videos;
        console.log(`[ProfileScreen] tap tile index=${index} (${list.length} total)`);
        // Navigate within the Profile tab's stack — keeps the bottom tab bar
        // visible and uses the same ReelCard layout as Home.
        navigation.navigate('ReelsFeed', {
          videos: list,
          initialIndex: index,
          source: 'profile',
        });
      }}
      onLongPress={activeTab === 'grid' ? () => handleTileLongPress(item) : undefined}
      showRepostBadge={activeTab === 'reposted'}
    />
  ), [navigation, activeTab, videos, reposts]);

  const keyExtractor = useCallback((item) => item._id, []);

  // Choose the right data source for the FlatList based on current state
  const data = useMemo(() => {
    if (activeTab === 'reposted') {
      if (repostsLoading && reposts.length === 0) return SKELETON_DATA;
      return reposts;
    }
    if (phase === 'loading' && videos.length === 0) return SKELETON_DATA;
    return videos;
  }, [phase, videos, reposts, repostsLoading, activeTab]);

  const isShowingSkeleton =
    (activeTab === 'grid'     && phase === 'loading' && videos.length === 0) ||
    (activeTab === 'reposted' && repostsLoading && reposts.length === 0);

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />

      {/* Top sticky header */}
      <View style={[S.topHeader, { backgroundColor: colors.bg, borderBottomColor: colors.divider }]}>
        <Text style={[S.topTitle, { color: colors.text }]}>Profile</Text>
        <View style={S.topActions}>
          <TouchableOpacity style={S.topBtn} hitSlop={S.hit}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={S.topBtn} hitSlop={S.hit} onPress={() => setShowMore(true)}>
            <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        numColumns={COL_COUNT}
        columnWrapperStyle={{ gap: GRID_GAP }}
        contentContainerStyle={{ gap: GRID_GAP, paddingBottom: 120 }}
        ListHeaderComponent={renderHeader}
        renderItem={isShowingSkeleton ? () => <SkeletonTile /> : renderItem}
        ListEmptyComponent={
          activeTab === 'reposted' ? (
            repostsLoaded && reposts.length === 0 ? (
              <View style={S.emptyWrap}>
                <View style={[S.emptyIconWrap, { backgroundColor: '#ecfdf5' }]}>
                  <Ionicons name="repeat" size={36} color="#10b981" />
                </View>
                <Text style={S.emptyTitle}>No reposts yet</Text>
                <Text style={S.emptySub}>Videos you repost will appear here.</Text>
              </View>
            ) : null
          ) : phase === 'error' ? (
            <ErrorState info={errorInfo} onRetry={() => loadRef.current()} />
          ) : phase === 'ready' && activeTab === 'grid' ? (
            <EmptyState onUpload={() => navigation.navigate('MainApp', { screen: 'Upload' })} />
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={9}
        maxToRenderPerBatch={9}
        windowSize={5}
      />

      <MoreOptionsSheet
        visible={showMore}
        onClose={() => setShowMore(false)}
        onSettings={() => navigation.navigate('Settings')}
        onHelp={() => navigation.navigate('HelpSupport')}
        onLogout={async () => { await logout(); }}
      />

      <VideoActionsSheet
        visible={!!actionsVideo}
        isPinned={!!actionsVideo?.pinned}
        onClose={() => setActionsVideo(null)}
        onPin={handlePinAction}
        onDelete={handleDeleteAction}
      />
    </View>
  );
}

// ─── Error state — surfaces the URL/userId/message so user can debug from device ───
function ErrorState({ info, onRetry }) {
  return (
    <View style={S.errWrap}>
      <View style={S.errIconWrap}>
        <Ionicons name="cloud-offline-outline" size={36} color="#ef4444" />
      </View>
      <Text style={S.errTitle}>Failed to load videos</Text>
      <Text style={S.errMsg}>{info?.message || 'Unknown error'}</Text>
      <View style={S.errMeta}>
        <Text style={S.errMetaLabel}>API:</Text>
        <Text style={S.errMetaValue} numberOfLines={2}>{info?.url || '—'}</Text>
        <Text style={S.errMetaLabel}>User:</Text>
        <Text style={S.errMetaValue} numberOfLines={1}>{info?.userId || '—'}</Text>
      </View>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.85} style={S.retryBtn}>
        <Ionicons name="refresh" size={16} color="#fff" />
        <Text style={S.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Empty state with CTA ─────────────────────────────────────────────────────
function EmptyState({ onUpload }) {
  return (
    <View style={S.emptyWrap}>
      <View style={S.emptyIconWrap}>
        <Ionicons name="videocam-outline" size={42} color="#3b82f6" />
      </View>
      <Text style={S.emptyTitle}>No videos uploaded yet</Text>
      <Text style={S.emptySub}>Share your first reel and it'll appear here.</Text>
      <TouchableOpacity onPress={onUpload} activeOpacity={0.85} style={S.uploadCta}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={S.uploadCtaText}>Upload First Video</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  hit:  { top: 10, bottom: 10, left: 10, right: 10 },

  topHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff', zIndex: 5,
  },
  topTitle:   { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  topActions: { flexDirection: 'row' },
  topBtn:     { padding: 6, marginLeft: 6 },

  profileBlock: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 22 },
  ringOuter:    { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  ringInner:    { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  avatarFallback:{ backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  avatarInitials:{ color: '#fff', fontWeight: '800' },

  fullName: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  username: { fontSize: 14, color: '#64748b', marginTop: 2 },
  locRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  locText:  { fontSize: 13, color: '#64748b', marginLeft: 4 },

  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 22, paddingHorizontal: 30,
  },
  stat:      { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  statLabel: { fontSize: 13, color: '#64748b', marginTop: 4 },

  tabsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0',
    marginBottom: 2,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#0f172a' },

  tile:   { width: TILE, height: TILE, backgroundColor: '#f1f5f9' },
  tileImg:{ width: '100%', height: '100%' },
  tilePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  tileViews: {
    position: 'absolute', left: 6, bottom: 6,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  tileViewsText: { color: '#fff', fontSize: 10.5, fontWeight: '700', marginLeft: 3 },

  pinBadge: {
    position: 'absolute', top: 6, left: 6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  repostBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#10b981',
    alignItems: 'center', justifyContent: 'center',
  },

  skel: { backgroundColor: '#e2e8f0' },

  emptyWrap:    { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyIconWrap:{
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#eff6ff',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle:   { fontSize: 17, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  emptySub:     { fontSize: 13.5, color: '#64748b', marginTop: 8, textAlign: 'center', lineHeight: 19 },
  uploadCta: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 20, paddingHorizontal: 22, paddingVertical: 11,
    borderRadius: 22, backgroundColor: '#3b82f6',
  },
  uploadCtaText: { color: '#fff', fontWeight: '800', fontSize: 14, marginLeft: 6 },

  // Error state
  errWrap: {
    alignItems: 'center', paddingVertical: 50, paddingHorizontal: 24,
  },
  errIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#fef2f2',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  errTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  errMsg:   { fontSize: 13.5, color: '#475569', marginTop: 8, textAlign: 'center' },
  errMeta:  {
    marginTop: 16, padding: 12, borderRadius: 10,
    backgroundColor: '#f1f5f9',
    width: '100%',
  },
  errMetaLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', marginTop: 4 },
  errMetaValue: { fontSize: 12, color: '#0f172a', fontFamily: 'monospace' },
  retryBtn: {
    marginTop: 16,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 22, paddingVertical: 11,
    borderRadius: 22, backgroundColor: '#3b82f6',
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 14, marginLeft: 6 },
});
