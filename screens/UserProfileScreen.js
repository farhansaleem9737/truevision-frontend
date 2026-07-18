// truevision/screens/UserProfileScreen.js
//
// Public profile of another user (route: 'UserProfile', params: { userId }).
// • Header: back, @username title, ellipsis menu (Block / Unblock)
// • Profile block: avatar (initials fallback), name + verified badge,
//   presence line (Online / Last seen …), @username, Private-Account pill, bio
// • Stats row: Videos / Followers / Following (last two → FollowList)
// • Action row: Follow (Follow / Requested / Following) + Message
// • Content: blocked state · private-account lock · 3-col video grid
//
// State machine: 'loading' | 'ready' | 'error'. Follow/unfollow and block
// actions are optimistic with rollback + Alert on failure.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, FlatList, RefreshControl,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import userService from '../services/UserService';
import videoService from '../services/VideoService';
import activityService from '../services/ActivityService';
import chatService from '../services/ChatService';

const { width } = Dimensions.get('window');
const GRID_GAP  = 2;
const COL_COUNT = 3;
const TILE      = (width - GRID_GAP * (COL_COUNT - 1)) / COL_COUNT;
const VIDEOS_PAGE_SIZE = 24;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtCount = (n) => {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

const ini = (n) => (n || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

const formatLastSeen = (d) => {
  if (!d) return '';
  const diff = Math.max(0, Date.now() - new Date(d).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Last seen just now';
  if (mins < 60) return `Last seen ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Last seen ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `Last seen ${days}d ago`;
  return `Last seen ${new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};

const SKELETON_DATA = Array.from({ length: 9 }, (_, i) => ({ _id: `skel-${i}` }));

// ─── Small building blocks ───────────────────────────────────────────────────
const Avatar = ({ uri, name, size, colors }) => (
  uri ? (
    <ExpoImage
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
      cachePolicy="memory-disk"
    />
  ) : (
    <View style={[
      S.avatarFallback,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent },
    ]}>
      <Text style={[S.avatarInitials, { fontSize: size * 0.34 }]}>{ini(name)}</Text>
    </View>
  )
);

const VideoTile = ({ video, onPress, colors }) => (
  <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[S.tile, { backgroundColor: colors.surface }]}>
    {video.thumbnailUrl ? (
      <ExpoImage
        source={{ uri: video.thumbnailUrl }}
        style={S.tileImg}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
    ) : (
      <View style={[S.tileImg, S.tilePlaceholder]}>
        <Ionicons name="videocam-outline" size={22} color={colors.textDim} />
      </View>
    )}
    <View style={S.tileViews}>
      <Ionicons name="eye-outline" size={11} color="#fff" />
      <Text style={S.tileViewsText}>{fmtCount(video.viewsCount)}</Text>
    </View>
  </TouchableOpacity>
);

// ─── Main ────────────────────────────────────────────────────────────────────
export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params || {};
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user: authUser } = useAuth();

  const myId   = authUser?._id || authUser?.id;
  const isSelf = !!myId && !!userId && String(myId) === String(userId);

  const [user, setUser]           = useState(null);
  const [phase, setPhase]         = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorMsg, setErrorMsg]   = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [videos, setVideos]             = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosPrivate, setVideosPrivate] = useState(false);
  const [vidPage, setVidPage]           = useState(1);
  const [vidHasMore, setVidHasMore]     = useState(false);
  const [loadingMore, setLoadingMore]   = useState(false);

  const [followBusy, setFollowBusy] = useState(false);
  const [msgBusy, setMsgBusy]       = useState(false);
  const [blockBusy, setBlockBusy]   = useState(false);

  const inFlight     = useRef(0);
  const vidInFlight  = useRef(0);
  const viewRecorded = useRef(false);
  const firstFocus   = useRef(true);

  // ── Profile loader ───────────────────────────────────────────────────────
  const loadProfile = useCallback(async ({ silent = false } = {}) => {
    if (!userId) {
      setPhase('error');
      setErrorMsg('No user specified.');
      return;
    }
    const token = ++inFlight.current;
    if (!silent) { setPhase('loading'); setErrorMsg(''); }

    const res = await userService.getUserProfile(userId);
    if (token !== inFlight.current) return;

    if (res?.success && res.user) {
      setUser(res.user);
      setPhase('ready');
    } else if (!silent) {
      setPhase('error');
      setErrorMsg(res?.message || 'Could not load this profile.');
    }
    setRefreshing(false);
  }, [userId]);

  // ── Videos loader (paginated grid) ───────────────────────────────────────
  const loadVideos = useCallback(async (p = 1) => {
    const token = ++vidInFlight.current;
    if (p === 1) setVideosLoading(true); else setLoadingMore(true);

    const res = await videoService.getUserVideos(userId, p, VIDEOS_PAGE_SIZE);
    if (token !== vidInFlight.current) return;

    if (res?.isPrivate) {
      // Server clamps a private account's grid regardless of success flag.
      setVideosPrivate(true);
      setVideos([]);
      setVidHasMore(false);
    } else if (res?.success) {
      const list = Array.isArray(res.videos) ? res.videos : [];
      setVideosPrivate(false);
      setVideos((prev) => p === 1
        ? list
        : [...prev, ...list.filter((v) => !prev.some((x) => x._id === v._id))]);
      setVidPage(p);
      const pages = res.pagination?.pages;
      setVidHasMore(pages != null ? p < pages : list.length === VIDEOS_PAGE_SIZE);
    }
    setVideosLoading(false);
    setLoadingMore(false);
  }, [userId]);

  // First load
  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Record the profile view once, fire-and-forget (never for own profile).
  useEffect(() => {
    if (!isSelf && userId && !viewRecorded.current) {
      viewRecorded.current = true;
      Promise.resolve(activityService.recordProfileView(userId)).catch(() => {});
    }
  }, [isSelf, userId]);

  // Load the grid once the profile says its content is viewable.
  const canViewContent = !!user?.canViewContent && !user?.isBlockedByMe;
  useEffect(() => {
    if (phase === 'ready' && canViewContent) loadVideos(1);
  }, [phase, canViewContent, loadVideos]);

  // Silent refresh when coming back (counts may have changed in FollowList).
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    loadProfile({ silent: true });
  }, [loadProfile]));

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile({ silent: true });
    if (canViewContent) loadVideos(1);
  };

  const onEndReached = () => {
    if (!canViewContent || videosPrivate) return;
    if (loadingMore || videosLoading || !vidHasMore) return;
    loadVideos(vidPage + 1);
  };

  // ── Follow / unfollow (optimistic with rollback) ─────────────────────────
  const followState = user?.isFollowing ? 'following' : user?.isRequested ? 'requested' : 'none';

  const doFollow = async () => {
    if (followBusy || !user) return;
    setFollowBusy(true);
    const prev = user;
    const assumeRequested = !!user.privateAccount;
    setUser((u) => ({
      ...u,
      isFollowing: !assumeRequested,
      isRequested: assumeRequested,
      followersCount: assumeRequested ? u.followersCount : (u.followersCount || 0) + 1,
    }));

    const res = await userService.followUser(userId);
    if (!res?.success) {
      setUser(prev);
      Alert.alert('Could not follow', res?.message || 'Try again later.');
    } else {
      const following = res.status === 'following';
      setUser((u) => ({
        ...u,
        isFollowing: following,
        isRequested: res.status === 'requested',
        followersCount: following ? (prev.followersCount || 0) + 1 : (prev.followersCount || 0),
      }));
      // Rare case: a "private" account accepted instantly (went public) —
      // re-fetch so canViewContent and the grid unlock.
      if (following && !prev.canViewContent) loadProfile({ silent: true });
    }
    setFollowBusy(false);
  };

  const doUnfollow = async () => {
    if (followBusy || !user) return;
    setFollowBusy(true);
    const prev = user;
    const wasFollowing = !!user.isFollowing;
    setUser((u) => ({
      ...u,
      isFollowing: false,
      isRequested: false,
      followersCount: wasFollowing ? Math.max(0, (u.followersCount || 0) - 1) : u.followersCount,
      canViewContent: u.privateAccount ? false : u.canViewContent,
    }));
    if (wasFollowing && prev.privateAccount) setVideos([]);

    const res = await userService.unfollowUser(userId);
    if (!res?.success) {
      setUser(prev);
      if (wasFollowing && prev.privateAccount && prev.canViewContent) loadVideos(1);
      Alert.alert('Could not update', res?.message || 'Try again later.');
    }
    setFollowBusy(false);
  };

  const confirmUnfollow = () => {
    const requested = followState === 'requested';
    Alert.alert(
      requested ? 'Cancel follow request?' : `Unfollow @${user?.username || 'user'}?`,
      requested
        ? 'They have not approved your request yet.'
        : 'If their account is private, you will need to request again.',
      [
        { text: requested ? 'Keep request' : 'Cancel', style: 'cancel' },
        {
          text: requested ? 'Cancel request' : 'Unfollow',
          style: 'destructive',
          onPress: doUnfollow,
        },
      ],
    );
  };

  const onFollowPress = () => {
    if (followState === 'none') doFollow();
    else confirmUnfollow();
  };

  // ── Message ──────────────────────────────────────────────────────────────
  const handleMessage = async () => {
    if (msgBusy || !user) return;
    setMsgBusy(true);
    const res = await chatService.createOrGetChat(userId);
    setMsgBusy(false);
    if (res?.success && res.chat) {
      navigation.navigate('ChatConversation', {
        chatId: res.chat._id,
        otherUser: res.chat.otherUser || {
          _id: user._id,
          fullName: user.fullName,
          username: user.username,
          profileImage: user.profileImage,
        },
      });
    } else {
      Alert.alert('Message', res?.message || "This user isn't accepting messages.");
    }
  };

  // ── Block / unblock ──────────────────────────────────────────────────────
  const doBlock = async () => {
    if (blockBusy) return;
    setBlockBusy(true);
    const res = await userService.blockUser(userId);
    setBlockBusy(false);
    if (res?.success) {
      setUser((u) => u ? { ...u, isBlockedByMe: true, isFollowing: false, isRequested: false } : u);
      setVideos([]);
      setVidHasMore(false);
    } else {
      Alert.alert('Could not block', res?.message || 'Try again later.');
    }
  };

  const confirmBlock = () => {
    Alert.alert(
      `Block @${user?.username || 'user'}?`,
      "They won't be able to follow you, message you, or see your videos. You can unblock them anytime.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: doBlock },
      ],
    );
  };

  const handleUnblock = async () => {
    if (blockBusy) return;
    setBlockBusy(true);
    const res = await userService.unblockUser(userId);
    setBlockBusy(false);
    if (res?.success) {
      setUser((u) => u ? { ...u, isBlockedByMe: false } : u);
      loadProfile({ silent: true });
    } else {
      Alert.alert('Could not unblock', res?.message || 'Try again later.');
    }
  };

  const openMenu = () => {
    if (!user) return;
    Alert.alert(
      `@${user.username || 'user'}`,
      undefined,
      user.isBlockedByMe
        ? [
            { text: 'Unblock', onPress: handleUnblock },
            { text: 'Cancel', style: 'cancel' },
          ]
        : [
            { text: 'Block', style: 'destructive', onPress: confirmBlock },
            { text: 'Cancel', style: 'cancel' },
          ],
    );
  };

  // ── Navigation helpers ───────────────────────────────────────────────────
  const openFollowList = (mode) => {
    navigation.navigate('FollowList', { userId, mode, username: user?.username });
  };

  const openVideo = (idx) => {
    navigation.navigate('VideoPlayer', { videos, initialIndex: idx });
  };

  // ── Header block (scrolls with the grid) ─────────────────────────────────
  const renderHeader = () => {
    if (!user) return null;
    return (
      <View>
        <View style={S.profileBlock}>
          <Avatar uri={user.profileImage} name={user.fullName} size={100} colors={colors} />

          <View style={S.nameRow}>
            <Text style={[S.fullName, { color: colors.text }]} numberOfLines={1}>
              {user.fullName || 'User'}
            </Text>
            {user.isVerified ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.accent} style={S.verifiedIcon} />
            ) : null}
          </View>

          {user.isOnline ? (
            <View style={S.presenceRow}>
              <View style={S.onlineDot} />
              <Text style={[S.presenceText, { color: '#22c55e' }]}>Online</Text>
            </View>
          ) : user.lastSeen ? (
            <Text style={[S.presenceText, { color: colors.textDim }]}>{formatLastSeen(user.lastSeen)}</Text>
          ) : null}

          <Text style={[S.username, { color: colors.textMuted }]}>@{user.username || 'user'}</Text>

          {user.privateAccount ? (
            <View style={[S.privatePill, { backgroundColor: colors.iconChipBg }]}>
              <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
              <Text style={[S.privatePillText, { color: colors.textMuted }]}>Private Account</Text>
            </View>
          ) : null}

          {user.bio ? (
            <Text style={[S.bio, { color: colors.text }]}>{user.bio}</Text>
          ) : null}
        </View>

        <View style={S.statsRow}>
          <View style={S.stat}>
            <Text style={[S.statValue, { color: colors.text }]}>{fmtCount(user.totalVideos)}</Text>
            <Text style={[S.statLabel, { color: colors.textMuted }]}>Videos</Text>
          </View>
          <TouchableOpacity style={S.stat} activeOpacity={0.7} onPress={() => openFollowList('followers')}>
            <Text style={[S.statValue, { color: colors.text }]}>{fmtCount(user.followersCount)}</Text>
            <Text style={[S.statLabel, { color: colors.textMuted }]}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.stat} activeOpacity={0.7} onPress={() => openFollowList('following')}>
            <Text style={[S.statValue, { color: colors.text }]}>{fmtCount(user.followingCount)}</Text>
            <Text style={[S.statLabel, { color: colors.textMuted }]}>Following</Text>
          </TouchableOpacity>
        </View>

        {!isSelf && !user.isBlockedByMe ? (
          <View style={S.actionRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={followBusy}
              onPress={onFollowPress}
              style={[
                S.followBtn,
                followState === 'none'      && { backgroundColor: colors.accent },
                followState === 'requested' && { backgroundColor: colors.iconChipBg },
                followState === 'following' && {
                  backgroundColor: 'transparent',
                  borderWidth: 1.5,
                  borderColor: colors.divider,
                },
                followBusy && { opacity: 0.6 },
              ]}
            >
              {followBusy ? (
                <ActivityIndicator
                  size="small"
                  color={followState === 'none' ? '#fff' : colors.textMuted}
                />
              ) : (
                <Text style={[
                  S.followBtnText,
                  followState === 'none'      && { color: '#fff' },
                  followState === 'requested' && { color: colors.textMuted },
                  followState === 'following' && { color: colors.text },
                ]}>
                  {followState === 'none' ? (user.followsMe ? 'Follow Back' : 'Follow')
                    : followState === 'requested' ? 'Requested'
                    : 'Following'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={msgBusy}
              onPress={handleMessage}
              style={[
                S.messageBtn,
                { borderColor: colors.divider },
                msgBusy && { opacity: 0.6 },
              ]}
            >
              {msgBusy ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={[S.messageBtnText, { color: colors.text }]}>Message</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[S.gridDivider, { borderTopColor: colors.divider }]} />
      </View>
    );
  };

  // ── Body states ──────────────────────────────────────────────────────────
  const contentLocked = !!user && (!user.canViewContent || videosPrivate) && !user.isBlockedByMe;
  const showSkeleton  = canViewContent && !videosPrivate && videosLoading && videos.length === 0;

  const listData = user?.isBlockedByMe || contentLocked
    ? []
    : showSkeleton ? SKELETON_DATA : videos;

  const renderItem = ({ item, index }) => (
    showSkeleton
      ? <View style={[S.tile, { backgroundColor: colors.iconChipBg }]} />
      : <VideoTile video={item} colors={colors} onPress={() => openVideo(index)} />
  );

  const renderEmpty = () => {
    if (!user) return null;
    if (user.isBlockedByMe) {
      return (
        <View style={S.stateWrap}>
          <View style={[S.stateIconWrap, { backgroundColor: colors.iconChipDanger }]}>
            <Ionicons name="ban-outline" size={38} color={colors.danger} />
          </View>
          <Text style={[S.stateTitle, { color: colors.text }]}>You've blocked this user</Text>
          <Text style={[S.stateSub, { color: colors.textMuted }]}>
            Unblock @{user.username || 'them'} to see their profile content again.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={blockBusy}
            onPress={handleUnblock}
            style={[S.stateBtn, { backgroundColor: colors.accent }, blockBusy && { opacity: 0.6 }]}
          >
            {blockBusy
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={S.stateBtnText}>Unblock</Text>}
          </TouchableOpacity>
        </View>
      );
    }
    if (contentLocked) {
      return (
        <View style={S.stateWrap}>
          <View style={[S.stateIconWrap, { backgroundColor: colors.iconChipBg }]}>
            <Ionicons name="lock-closed-outline" size={38} color={colors.textMuted} />
          </View>
          <Text style={[S.stateTitle, { color: colors.text }]}>This Account is Private</Text>
          <Text style={[S.stateSub, { color: colors.textMuted }]}>
            Follow this account to see their videos.
          </Text>
        </View>
      );
    }
    if (videosLoading) return null;
    return (
      <View style={S.stateWrap}>
        <View style={[S.stateIconWrap, { backgroundColor: colors.iconChipBg }]}>
          <Ionicons name="videocam-outline" size={38} color={colors.textMuted} />
        </View>
        <Text style={[S.stateTitle, { color: colors.text }]}>No videos yet</Text>
        <Text style={[S.stateSub, { color: colors.textMuted }]}>
          Videos they share will appear here.
        </Text>
      </View>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />

      <ScreenHeader
        title={user?.username ? `@${user.username}` : 'Profile'}
        onBack={() => navigation.goBack()}
        right={
          !isSelf && phase === 'ready' ? (
            <TouchableOpacity onPress={openMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : null
        }
      />

      {phase === 'loading' ? (
        <ProfileSkeleton colors={colors} />
      ) : phase === 'error' ? (
        <View style={S.stateWrap}>
          <View style={[S.stateIconWrap, { backgroundColor: colors.iconChipDanger }]}>
            <Ionicons name="cloud-offline-outline" size={38} color={colors.danger} />
          </View>
          <Text style={[S.stateTitle, { color: colors.text }]}>Couldn't load profile</Text>
          <Text style={[S.stateSub, { color: colors.textMuted }]}>{errorMsg || 'Something went wrong.'}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => loadProfile()}
            style={[S.stateBtn, { backgroundColor: colors.accent }]}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={[S.stateBtnText, { marginLeft: 6 }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item._id}
          numColumns={COL_COUNT}
          columnWrapperStyle={{ gap: GRID_GAP }}
          contentContainerStyle={{ gap: GRID_GAP, paddingBottom: insets.bottom + 40 }}
          ListHeaderComponent={renderHeader}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            loadingMore
              ? <View style={S.footerLoader}><ActivityIndicator color={colors.accent} /></View>
              : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
        />
      )}
    </View>
  );
}

// ─── Full-page skeleton while the profile loads ──────────────────────────────
function ProfileSkeleton({ colors }) {
  const block = { backgroundColor: colors.iconChipBg };
  return (
    <View style={S.skelWrap}>
      <View style={[S.skelAvatar, block]} />
      <View style={[S.skelLineWide, block]} />
      <View style={[S.skelLineNarrow, block]} />
      <View style={S.skelStatsRow}>
        <View style={[S.skelStat, block]} />
        <View style={[S.skelStat, block]} />
        <View style={[S.skelStat, block]} />
      </View>
      <View style={S.skelBtnRow}>
        <View style={[S.skelBtn, block]} />
        <View style={[S.skelBtn, block]} />
      </View>
      <View style={S.skelGrid}>
        {SKELETON_DATA.map((s) => (
          <View key={s._id} style={[S.tile, block]} />
        ))}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1 },

  // Profile block
  profileBlock:   { alignItems: 'center', paddingTop: 24, paddingHorizontal: 22 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '800' },
  nameRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 12, maxWidth: '90%' },
  fullName:       { fontSize: 20, fontWeight: '800', flexShrink: 1 },
  verifiedIcon:   { marginLeft: 5 },
  presenceRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  onlineDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 5 },
  presenceText:   { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  username:       { fontSize: 14, marginTop: 3 },
  privatePill: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  privatePillText: { fontSize: 11.5, fontWeight: '700', marginLeft: 5 },
  bio: { fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: 10, maxWidth: '92%' },

  // Stats
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 20, paddingHorizontal: 30,
  },
  stat:      { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 21, fontWeight: '800' },
  statLabel: { fontSize: 13, marginTop: 4 },

  // Action row
  actionRow: {
    flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 18, gap: 10,
  },
  followBtn: {
    flex: 1, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  followBtnText: { fontSize: 14.5, fontWeight: '800' },
  messageBtn: {
    flex: 1, height: 42, borderRadius: 21, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  messageBtnText: { fontSize: 14.5, fontWeight: '800' },

  gridDivider: { borderTopWidth: StyleSheet.hairlineWidth, marginBottom: GRID_GAP },

  // Grid tiles
  tile:            { width: TILE, height: TILE },
  tileImg:         { width: '100%', height: '100%' },
  tilePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  tileViews: {
    position: 'absolute', left: 6, bottom: 6,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  tileViewsText: { color: '#fff', fontSize: 10.5, fontWeight: '700', marginLeft: 3 },

  footerLoader: { paddingVertical: 18 },

  // Full-screen / list states
  stateWrap:     { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32 },
  stateIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  stateTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  stateSub:   { fontSize: 13.5, marginTop: 8, textAlign: 'center', lineHeight: 19 },
  stateBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 20, paddingHorizontal: 26, paddingVertical: 11, borderRadius: 22,
    minWidth: 120, justifyContent: 'center',
  },
  stateBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Skeleton
  skelWrap:       { alignItems: 'center', paddingTop: 24 },
  skelAvatar:     { width: 100, height: 100, borderRadius: 50 },
  skelLineWide:   { width: 160, height: 18, borderRadius: 9, marginTop: 16 },
  skelLineNarrow: { width: 100, height: 13, borderRadius: 7, marginTop: 10 },
  skelStatsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    alignSelf: 'stretch', paddingHorizontal: 40, marginTop: 24,
  },
  skelStat: { width: 56, height: 40, borderRadius: 8 },
  skelBtnRow: {
    flexDirection: 'row', alignSelf: 'stretch',
    paddingHorizontal: 20, marginTop: 24, gap: 10,
  },
  skelBtn:  { flex: 1, height: 42, borderRadius: 21 },
  skelGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    alignSelf: 'stretch', gap: GRID_GAP, marginTop: 24,
  },
});
