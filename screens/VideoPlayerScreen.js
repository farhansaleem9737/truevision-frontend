import React, {
  useState, useRef, useEffect, useCallback,
} from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback,
  StatusBar, Dimensions, FlatList,
  Platform, Animated, Image,
  ActivityIndicator, Alert, Share, StyleSheet,
} from 'react-native';

import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent }                  from 'expo';
import { LinearGradient }            from 'expo-linear-gradient';
import { Ionicons }                  from '@expo/vector-icons';
import Slider                        from '@react-native-community/slider';
import { useSafeAreaInsets }         from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import videoService                  from '../services/VideoService';
import userService                   from '../services/UserService';
import { useAuth }                   from '../context/AuthContext';
import CommentsSheet                 from '../components/comments/CommentsSheet';
import InfoButton                    from '../components/video/InfoButton';
import VideoInfoPanel                from '../components/video/VideoInfoPanel';

const { width, height } = Dimensions.get('window');

// ── Must match BottomTabNavigator tabBarStyle.height ─────────────────────────
const TAB_BAR_BASE = 65;

// ─────────────────────────────────────────────────────────────────────────────
// FEED DATA
// ─────────────────────────────────────────────────────────────────────────────
const buildFeed = (v) => {
  const seed = {
    id:          v?.id          || 'f1',
    uri:         v?.video_files?.[0]?.link ||
                 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    user:        v?.user        || { name:'Nicholaus Choi', avatar:'https://i.pravatar.cc/150?img=1' },
    title:       v?.title       || 'Big Buck Bunny',
    description: v?.description || 'The classic open-source animation 🐰✨ #animation #cute',
    song:        v?.song        || 'Original Sound – bunny_studios',
    duration:    v?.duration    || 53,
    likes:       v?.likes       || 142600,
    comments:    v?.comments    || 3200,
    reposts:     v?.reposts     || 890,
    shares:      v?.shares      || 8900,
    saves:       v?.saves       || 5082,
    views:       v?.views       || 560000,
    isFollowing: v?.isFollowing || false,
  };
  return [
    seed,
    { id:'f2',
      uri:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      user:{ name:'dreamer_films', avatar:'https://i.pravatar.cc/150?img=2' },
      title:"Elephant's Dream",
      description:'A surreal open-source animation journey 🐘💭 #blender #art',
      song:'Elephants Dream OST',
      duration:658, likes:98200, comments:1540, reposts:320, shares:4300, saves:2100, views:312000, isFollowing:true },
    { id:'f3',
      uri:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      user:{ name:'blazevfx', avatar:'https://i.pravatar.cc/150?img=3' },
      title:'For Bigger Blazes',
      description:'Turn up the heat 🔥🔥🔥 #vfx #fire #epicshots',
      song:'Heat Wave – blazevfx',
      duration:15, likes:512000, comments:8720, reposts:2100, shares:31200, saves:5069, views:1200000, isFollowing:false },
    { id:'f4',
      uri:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      user:{ name:'adventureseeker', avatar:'https://i.pravatar.cc/150?img=4' },
      title:'For Bigger Escapes',
      description:'Escape the ordinary 🌄 #travel #adventure #explore',
      song:'Run Wild – adventureseeker',
      duration:15, likes:234000, comments:5620, reposts:980, shares:12400, saves:3400, views:890000, isFollowing:false },
    { id:'f5',
      uri:'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
      user:{ name:'subarunation', avatar:'https://i.pravatar.cc/150?img=5' },
      title:'Street & Dirt',
      description:'We own every road 🚗💨 #subaru #offroad #carsoftiktok',
      song:'Drive It Like You Stole It',
      duration:60, likes:389000, comments:7890, reposts:1540, shares:22100, saves:4200, views:780000, isFollowing:true },
  ];
};

// ─────────────────────────────────────────────────────────────────────────────
// MAP BACKEND VIDEO → VideoItem format
// ─────────────────────────────────────────────────────────────────────────────
const mapApiVideo = (v) => {
  // userId may arrive populated (object), as a raw ObjectId string, or absent.
  const populated = v.userId && typeof v.userId === 'object' ? v.userId : null;
  const username  = populated?.username || populated?.fullName || v.user?.name || 'creator';
  // Never fall back to pravatar — it generates random faces that look like a
  // different person. Empty string lets the UI render an initials placeholder.
  const avatar    = populated?.profileImage || v.user?.avatar || '';
  return {
    id:          v._id  || v.id  || String(Math.random()),
    uri:         v.videoUrl || v.uri || '',
    user: {
      name:       username,
      avatar,
      isVerified: !!(populated?.isVerified),
    },
    title:       v.title       || '',
    description: v.description || '',
    song:        v.song        || `Original Sound – ${username}`,
    duration:    v.duration    || 0,
    likes:       v.likesCount  || 0,
    comments:    v.commentsCount || 0,
    reposts:     v.repostsCount  || 0,
    shares:      v.sharesCount   || 0,
    saves:       v.savesCount    || 0,
    views:       v.viewsCount    || 0,
    isFollowing: false,
    isLiked:     v.isLiked  || false,
    isSaved:     v.isSaved  || false,
    videoId:     v._id      || v.id,
    ownerId:     v.userId?._id || v.userId || null,
    pinned:      !!v.pinned,
  };
};

// (Mock comment data removed — comments are now backed by Firestore via CommentsSheet.)

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};
const fmtSec = (s) => {
  if (!s || isNaN(s)) return '0:00';
  const t = Math.floor(s);
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// HEART BURST  (double-tap like)
// ─────────────────────────────────────────────────────────────────────────────
const HeartBurst = ({ visible, x, y }) => {
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    scale.setValue(0); opacity.setValue(1);
    Animated.parallel([
      Animated.spring(scale, { toValue:1.4, useNativeDriver:true, friction:4 }),
      Animated.sequence([
        Animated.delay(280),
        Animated.timing(opacity, { toValue:0, duration:380, useNativeDriver:true }),
      ]),
    ]).start();
  }, [visible, x, y]);
  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={{
      position:'absolute', left:x - 50, top:y - 50,
      width:100, height:100, alignItems:'center', justifyContent:'center',
      transform:[{ scale }], opacity, zIndex:999,
    }}>
      <Ionicons name="heart" size={90} color="white" />
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SPINNING MUSIC DISC
// ─────────────────────────────────────────────────────────────────────────────
const SpinningDisc = ({ avatarUri, paused, fallbackInitial = '?' }) => {
  const spin    = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  useEffect(() => {
    animRef.current?.stop();
    if (!paused) {
      animRef.current = Animated.loop(
        Animated.timing(spin, { toValue:1, duration:5000, useNativeDriver:true })
      );
      animRef.current.start();
    }
    return () => animRef.current?.stop();
  }, [paused]);
  const rotate = spin.interpolate({ inputRange:[0,1], outputRange:['0deg','360deg'] });
  return (
    <Animated.View style={{ transform:[{ rotate }] }}>
      {/* Outer ring — gradient-style using border */}
      <View style={S.discOuter}>
        {avatarUri ? (
          <Image source={{ uri:avatarUri }} style={S.discImg} />
        ) : (
          <View style={[S.discImg, { backgroundColor:'#3b82f6', alignItems:'center', justifyContent:'center' }]}>
            <Text style={{ color:'#fff', fontWeight:'800', fontSize:20 }}>{fallbackInitial}</Text>
          </View>
        )}
        <View style={S.discHole} />
      </View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SONG TICKER
// ─────────────────────────────────────────────────────────────────────────────
const SongTicker = ({ song }) => {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue:-160, duration:4500, useNativeDriver:true }),
        Animated.timing(x, { toValue:0,    duration:0,    useNativeDriver:true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [song]);
  return (
    <View style={S.tickerRow}>
      <Ionicons name="musical-note" size={13} color="white" />
      <View style={S.tickerClip}>
        <Animated.Text numberOfLines={1} style={[S.tickerText, { transform:[{ translateX:x }] }]}>
          {song}{'     ·     '}{song}
        </Animated.Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMMENT SHEET — backed by Firestore. See components/comments/CommentsSheet.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE VIDEO ITEM
// ─────────────────────────────────────────────────────────────────────────────
const VideoItem = ({ item, isActive, isFocused = true, onOpenComments, tabOffset, onMore }) => {
  const navigation = useNavigation();
  const { user: authUser } = useAuth();

  // The signed-in user never sees a Follow button on their own videos.
  const isSelf = !!(authUser?._id && item.ownerId && String(item.ownerId) === String(authUser._id));

  // ── expo-video player ─────────────────────────────────────────────────────
  const player = useVideoPlayer(item.uri, (p) => {
    p.loop  = true;
    p.muted = false;
  });
  const { isPlaying: playerPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [isReady,     setIsReady]     = useState(false);

  useEffect(() => {
    const s1 = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        setIsReady(true);
        setDuration(player.duration ?? 0);
      }
    });
    const s2 = player.addListener('timeUpdate', ({ currentTime:t }) => setCurrentTime(t ?? 0));
    return () => { s1.remove(); s2.remove(); };
  }, [player]);

  // ── Playback control — pause when screen unfocused (no background play) ──
  const [userPaused, setUserPaused]   = useState(false);
  useEffect(() => {
    if (isActive && isFocused && !userPaused) player.play();
    else player.pause();
  }, [isActive, isFocused, userPaused, player]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isLiked,     setIsLiked]     = useState(item.isLiked ?? false);
  const [isSaved,     setIsSaved]     = useState(item.isSaved ?? false);
  const [isReposted,  setIsReposted]  = useState(item.isReposted ?? false);
  const [isMuted,     setIsMuted]     = useState(false);
  const [showInfo,    setShowInfo]    = useState(false);
  // Follow is three-state: 'none' | 'following' | 'requested' (private accounts).
  const [followStatus, setFollowStatus] = useState(item.isFollowing ? 'following' : 'none');
  const [likes,       setLikes]       = useState(item.likes ?? 0);
  const [saves,       setSaves]       = useState(item.saves ?? 0);
  const [reposts,     setReposts]     = useState(item.reposts ?? 0);
  const [captionFull, setCaptionFull] = useState(false);
  const [burst,       setBurst]       = useState({ visible:false, x:0, y:0 });

  const likeAnim   = useRef(new Animated.Value(1)).current;
  const saveAnim   = useRef(new Animated.Value(1)).current;
  const repostAnim = useRef(new Animated.Value(1)).current;
  const pauseAnim  = useRef(new Animated.Value(0)).current;
  const lastTap    = useRef(0);

  const bounce = (anim) => Animated.sequence([
    Animated.spring(anim, { toValue:1.4, useNativeDriver:true, friction:4 }),
    Animated.spring(anim, { toValue:1,   useNativeDriver:true }),
  ]).start();

  // ── Tap: single = pause/play, double = like ───────────────────────────────
  const handleTap = useCallback((evt) => {
    const now = Date.now();
    const { locationX, locationY } = evt.nativeEvent;
    if (now - lastTap.current < 280) {
      // Double tap
      if (!isLiked) { setIsLiked(true); setLikes(l => l + 1); bounce(likeAnim); }
      setBurst({ visible:false, x:locationX, y:locationY });
      setTimeout(() => setBurst({ visible:true, x:locationX, y:locationY }), 10);
    } else {
      // Single tap
      setUserPaused(p => {
        pauseAnim.setValue(1);
        Animated.timing(pauseAnim, { toValue:0, duration:600, delay:280, useNativeDriver:true }).start();
        return !p;
      });
    }
    lastTap.current = now;
  }, [isLiked]);

  const handleLike = async () => {
    const wasLiked = isLiked;
    // Optimistic flip first so the tap feels instant.
    setIsLiked(!wasLiked);
    setLikes(c => wasLiked ? Math.max(0, c - 1) : c + 1);
    bounce(likeAnim);
    if (!item.videoId) return; // sample/legacy items — local only
    const res = await videoService.toggleLike(item.videoId);
    if (!res?.success) {
      // Revert on failure and surface the reason when the server gives one
      // (e.g. blocked by the creator).
      setIsLiked(wasLiked);
      setLikes(c => wasLiked ? c + 1 : Math.max(0, c - 1));
      if (res?.message) Alert.alert('Could not update like', res.message);
    }
  };

  const handleSave = async () => {
    const next = !isSaved;
    // Optimistic flip first so the tap feels instant.
    setIsSaved(next);
    setSaves(c => Math.max(0, next ? c + 1 : c - 1));
    bounce(saveAnim);
    if (!item.videoId) { // sample/legacy items — local only
      Alert.alert(next ? 'Saved' : 'Removed', next ? 'Added to your saved collection.' : 'Removed from saved.');
      return;
    }
    const res = await videoService.toggleSave(item.videoId);
    if (!res?.success) {
      // Revert on failure and surface the server's reason when present.
      setIsSaved(!next);
      setSaves(c => Math.max(0, next ? c - 1 : c + 1));
      Alert.alert('Could not update save', res?.message || 'Try again later.');
      return;
    }
    Alert.alert(next ? 'Saved' : 'Removed', next ? 'Added to your saved collection.' : 'Removed from saved.');
  };

  const handleFollow = async () => {
    if (isSelf || followStatus !== 'none') return;
    // Sample/legacy items carry no ownerId — keep the old local-only behaviour.
    if (!item.ownerId) { setFollowStatus('following'); return; }
    const prev = followStatus;
    setFollowStatus('following'); // optimistic — server may downgrade to 'requested'
    const res = await userService.followUser(String(item.ownerId));
    if (res?.success) {
      setFollowStatus(res.status === 'requested' ? 'requested' : 'following');
    } else {
      setFollowStatus(prev);
      Alert.alert('Could not follow', res?.message || 'Try again later.');
    }
  };

  const handleRepost = async () => {
    if (!item.videoId) return;
    const next = !isReposted;
    setIsReposted(next);
    setReposts(c => Math.max(0, next ? c + 1 : c - 1));
    bounce(repostAnim);

    const res = await videoService.toggleRepost(item.videoId);
    if (!res.success) {
      setIsReposted(!next);
      setReposts(c => Math.max(0, !next ? c + 1 : c - 1));
      Alert.alert('Repost failed', res.message || 'Try again later.');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message:`Check out "${item.title}" by @${creator}`, url:item.uri });
      // Record the share on the backend for real videos (fire-and-forget) —
      // sample/legacy items carry no videoId.
      if (item.videoId) videoService.shareVideo(item.videoId);
    } catch (_) {}
  };

  const handleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    player.muted = next;
  };

  const handleSeek = (val) => {
    if (duration > 0) player.currentTime = val * duration;
  };

  const progress  = duration > 0 ? currentTime / duration : 0;
  const nowPlaying= playerPlaying && !userPaused && isActive;
  const creator   = item.user?.name   || 'creator';
  const avatar    = item.user?.avatar || '';      // empty → initials fallback
  const isVerified= !!item.user?.isVerified;
  const song      = item.song         || `Original Sound – ${creator}`;
  const initial   = (creator?.[0] || '?').toUpperCase();

  return (
    <View style={{ width, height, backgroundColor:'#000' }}>

      {/* ── VIDEO ── */}
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={StyleSheet.absoluteFill}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            fullscreenOptions={{ isFullscreenButtonHidden:true }}
          />

          {/* Top gradient */}
          <LinearGradient
            colors={['rgba(0,0,0,0.38)', 'transparent']}
            style={{ position:'absolute', top:0, left:0, right:0, height:100 }}
            pointerEvents="none"
          />
          {/* Bottom gradient — covers info area */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.78)']}
            style={{ position:'absolute', bottom:0, left:0, right:0, height: tabOffset + 220 }}
            pointerEvents="none"
          />

          {/* Loading */}
          {!isReady && (
            <View style={S.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
            </View>
          )}

          {/* Pause / play flash */}
          <Animated.View pointerEvents="none" style={[S.pauseFlash, { opacity:pauseAnim }]}>
            <View style={S.pauseFlashBg}>
              <Ionicons name={userPaused ? 'play' : 'pause'} size={38} color="white" />
            </View>
          </Animated.View>

          {/* Heart burst */}
          <HeartBurst visible={burst.visible} x={burst.x} y={burst.y} />
        </View>
      </TouchableWithoutFeedback>

      {/* ── TOP-RIGHT: MUTE BUTTON (matching screenshot 1) ── */}
      <View style={[S.muteBtn, { top: 48 }]}>
        <TouchableOpacity onPress={handleMute} style={S.muteBtnInner}>
          <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={18} color="white" />
        </TouchableOpacity>
      </View>

      {/* ── TOP-RIGHT: INFO BUTTON (ⓘ) ── */}
      {/* Sits just left of the mute button (mute is right:14 width:40 → ⓘ at right:64). */}
      <View style={{ position: 'absolute', top: 54, right: 64, zIndex: 30 }}>
        <InfoButton onPress={() => setShowInfo(true)} />
      </View>

      {/* ── INFO PANEL bottom sheet ── */}
      <VideoInfoPanel
        visible={showInfo}
        onClose={() => setShowInfo(false)}
        video={item}
      />

      {/* ── PROGRESS BAR  (thin white line just above info panel) ── */}
      <View pointerEvents="none" style={[S.progressTrack, { bottom: tabOffset + 96 }]}>
        <View style={[S.progressFill, { width:`${progress * 100}%` }]} />
      </View>
      {/* Invisible scrub slider */}
      <View style={{ position:'absolute', bottom: tabOffset + 80, left:0, right:0, height:38, zIndex:30 }}>
        <Slider
          style={{ width:'100%', height:38 }}
          minimumValue={0} maximumValue={1} value={progress}
          onSlidingComplete={handleSeek}
          minimumTrackTintColor="transparent"
          maximumTrackTintColor="transparent"
          thumbTintColor="transparent"
        />
      </View>

      {/* ── RIGHT ACTION COLUMN  (matching Instagram screenshot 2) ── */}
      {/* Anchored to bottom of video area, above info panel */}
      <View style={[S.actionCol, { bottom: tabOffset + 106 }]}>

        {/* Like */}
        <TouchableOpacity onPress={handleLike} style={S.actionItem}>
          <Animated.View style={{ transform:[{ scale:likeAnim }] }}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={30}
              color={isLiked ? '#e11d48' : 'white'}
            />
          </Animated.View>
          <Text style={S.actionLabel}>{fmt(likes)}</Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity onPress={onOpenComments} style={S.actionItem}>
          <Ionicons name="chatbubble-outline" size={28} color="white" />
          <Text style={S.actionLabel}>{fmt(item.comments)}</Text>
        </TouchableOpacity>

        {/* Repost */}
        <TouchableOpacity onPress={handleRepost} style={S.actionItem}>
          <Animated.View style={{ transform: [{ scale: repostAnim }] }}>
            <Ionicons
              name={isReposted ? 'repeat' : 'repeat-outline'}
              size={28}
              color={isReposted ? '#10b981' : 'white'}
            />
          </Animated.View>
          <Text style={[S.actionLabel, isReposted && { color: '#10b981' }]}>{fmt(reposts)}</Text>
        </TouchableOpacity>

        {/* Send / Share */}
        <TouchableOpacity onPress={handleShare} style={S.actionItem}>
          <Ionicons name="paper-plane-outline" size={27} color="white" />
          <Text style={S.actionLabel}>{fmt(item.shares)}</Text>
        </TouchableOpacity>

        {/* Save */}
        <TouchableOpacity onPress={handleSave} style={S.actionItem}>
          <Animated.View style={{ transform:[{ scale:saveAnim }] }}>
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={27}
              color={isSaved ? '#3b82f6' : 'white'}
            />
          </Animated.View>
          <Text style={[S.actionLabel, isSaved && { color:'#3b82f6' }]}>{fmt(saves)}</Text>
        </TouchableOpacity>

        {/* More (⋮) */}
        <TouchableOpacity onPress={() => onMore?.(item)} style={[S.actionItem, { marginBottom:16 }]}>
          <Ionicons name="ellipsis-vertical" size={22} color="white" />
        </TouchableOpacity>

        {/* Spinning music disc */}
        <SpinningDisc avatarUri={avatar} paused={!nowPlaying} fallbackInitial={initial} />
      </View>

      {/* ── BOTTOM INFO PANEL  (left side, matching screenshot 1 layout) ── */}
      <View style={[S.infoPanel, { bottom: tabOffset + 10 }]}>

        {/* Creator row: avatar • @name • [Follow] */}
        <View style={S.creatorRow}>
          <TouchableOpacity
            onPress={() => { if (item.ownerId) navigation.navigate('UserProfile', { userId: String(item.ownerId) }); }}
            activeOpacity={0.8}
            style={{ flexDirection:'row', alignItems:'center', flexShrink:1 }}
          >
            {avatar ? (
              <Image source={{ uri:avatar }} style={S.creatorAvatar} />
            ) : (
              <View style={[S.creatorAvatar, { backgroundColor:'#3b82f6', alignItems:'center', justifyContent:'center' }]}>
                <Text style={{ color:'#fff', fontWeight:'800', fontSize:13 }}>{initial}</Text>
              </View>
            )}
            <Text style={S.creatorName} numberOfLines={1}>@{creator}</Text>
            {isVerified ? (
              <Ionicons name="checkmark-circle" size={14} color="#3b82f6" style={{ marginLeft: 4 }} />
            ) : null}
          </TouchableOpacity>
          {isSelf ? null : followStatus !== 'none' ? (
            <View style={S.followingPill}>
              <Text style={S.followingText}>{followStatus === 'requested' ? 'Requested' : 'Following'}</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={handleFollow} style={S.followPill}>
              <Text style={S.followText}>Follow</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Caption with expand */}
        <TouchableWithoutFeedback onPress={() => setCaptionFull(f => !f)}>
          <View style={{ marginBottom:8 }}>
            <Text numberOfLines={captionFull ? undefined : 2} style={S.caption}>
              {item.description || item.title}
            </Text>
            {!captionFull && <Text style={S.captionMore}>more</Text>}
          </View>
        </TouchableWithoutFeedback>

        {/* Views • duration */}
        <View style={S.metaRow}>
          <Ionicons name="eye-outline" size={13} color="rgba(255,255,255,0.65)" />
          <Text style={S.metaText}>{fmt(item.views ?? 0)} views</Text>
          <View style={S.metaDot} />
          <Text style={S.metaText}>{fmtSec(item.duration ?? 0)}</Text>
        </View>

        {/* Song ticker */}
        <SongTicker song={song} />
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT  — VideoPlayerScreen
// Your BottomTabNavigator renders the tab bar; this screen just clears space for it.
// ─────────────────────────────────────────────────────────────────────────────
export default function VideoPlayerScreen({ navigation, route }) {
  // ─────────────────────────────────────────────────────────────────────────
  // ALL HOOKS FIRST — React's rule-of-hooks requires every render to call the
  // same hooks in the same order. Any early return below this block is safe.
  // ─────────────────────────────────────────────────────────────────────────
  const params       = route?.params || {};
  const initialVideo = params?.video || null;
  // When opened from a profile/list, the caller passes the whole array plus the
  // tapped index. We render that exact list at exactly that position rather
  // than reloading the public feed (which would scramble ordering and snap to 0).
  const preloadedRaw   = Array.isArray(params?.videos) ? params.videos : null;
  const initialIndex   = Number.isInteger(params?.initialIndex) ? params.initialIndex : 0;
  // Deep link by id only (chat video bubbles, notifications, share links):
  // fetch the single video and render it as a one-item feed.
  const soloVideoId    = (!initialVideo && !preloadedRaw && params?.videoId)
    ? String(params.videoId)
    : null;

  const insets     = useSafeAreaInsets();
  const isFocused  = useIsFocused();
  const { user: authUser } = useAuth();
  const flatListRef = useRef(null);

  // Tracks whether the screen is still mounted — guards async setState calls.
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  // Pre-mapped preloaded list, computed once on mount. Used for both the
  // initial feed state and to gate the public-feed fetch.
  const preloadedFeed = useRef(
    preloadedRaw
      ? preloadedRaw.map(mapApiVideo).filter((v) => !!v.uri)
      : null
  ).current;

  const safeInitialIndex = Math.min(
    Math.max(0, initialIndex),
    Math.max(0, (preloadedFeed?.length || 1) - 1),
  );

  console.log('[VideoPlayer] mounted', {
    preloaded:    preloadedFeed?.length || 0,
    initialIndex: safeInitialIndex,
    deepLinked:   !!initialVideo,
  });

  const [feed,        setFeed]        = useState(preloadedFeed || []);
  const [loading,     setLoading]     = useState(!preloadedFeed);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page,        setPage]        = useState(1);
  // Can't paginate a frozen list or a single deep-linked video.
  const [hasMore,     setHasMore]     = useState(!preloadedFeed && !soloVideoId);
  const [activeIndex, setActiveIndex] = useState(safeInitialIndex);
  const [showComments, setShowComments] = useState(false);
  const [error,       setError]       = useState(null);
  // Deep-linked video came back 403/404 (private / blocked / deleted).
  const [unavailable, setUnavailable] = useState(false);

  // ── Fetch videos from backend ───────────────────────────────────────────
  const loadFeed = useCallback(async (pageNum, reset = false) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    if (reset) setError(null);

    try {
      const res = await videoService.getFeed(pageNum, 10, 'new');
      if (!isMounted.current) return;

      if (res.success && res.videos?.length > 0) {
        const mapped = res.videos.map(mapApiVideo).filter((v) => !!v.uri);
        setFeed((prev) => (reset ? mapped : [...prev, ...mapped]));
        setHasMore(pageNum < (res.pagination?.pages ?? 1));
        setPage(pageNum);
      } else if (reset) {
        // No real videos came back — fall back to sample content if a deep-linked
        // video was passed, otherwise show empty state.
        if (initialVideo) {
          setFeed(buildFeed(initialVideo));
        } else {
          setFeed([]);
        }
        setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      if (!isMounted.current) return;
      console.log('[VideoPlayer] loadFeed error:', e?.message);
      if (reset) {
        setError(e?.message || 'Could not load videos');
        if (initialVideo) setFeed(buildFeed(initialVideo));
        setHasMore(false);
      }
    } finally {
      if (!isMounted.current) return;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [initialVideo]);

  // Initial load (one-shot). Skipped when the caller pre-supplied a list.
  // A videoId-only deep link fetches that single video instead of the feed.
  useEffect(() => {
    if (preloadedFeed) return;
    if (soloVideoId) {
      (async () => {
        const res = await videoService.getVideoById(soloVideoId);
        if (!isMounted.current) return;
        const mapped = (res?.success && res.video) ? mapApiVideo(res.video) : null;
        if (mapped?.uri) {
          setFeed([mapped]);
        } else {
          // 403/404 — private, blocked or deleted.
          setUnavailable(true);
        }
        setLoading(false);
      })();
      return;
    }
    loadFeed(1, true);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // Deep-linked single video — prepend it once when no preloaded list exists.
  // (When a list is passed the tapped video is already inside it.)
  useEffect(() => {
    if (preloadedFeed) return;
    if (!initialVideo) return;
    const mapped = mapApiVideo(initialVideo);
    if (!mapped.uri) return;
    setFeed((prev) => {
      const exists = prev.some((v) => v.id === mapped.id);
      return exists ? prev : [mapped, ...prev];
    });
  }, [initialVideo, preloadedFeed]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) loadFeed(page + 1);
  }, [loadingMore, hasMore, page, loadFeed]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
      setShowComments(false);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;

  // VideoPlayer is rendered above the bottom-tab navigator (no tab bar shows
  // beneath it), so layouts only need the safe-area inset. Adding TAB_BAR_BASE
  // here was leaving ~65px of empty black space below the action column.
  const tabOffset = insets.bottom > 0 ? insets.bottom : Platform.select({ ios: 8, android: 8 });

  // ── Three-dot menu — Delete + Pin for the owner, Report otherwise ─────
  const handleMore = useCallback((item) => {
    const isOwner = authUser?._id && item.ownerId && (item.ownerId === authUser._id);

    const ownerOptions = [
      {
        text: item.pinned ? 'Unpin from profile' : 'Pin to profile',
        onPress: async () => {
          const next = !item.pinned;
          setFeed((prev) => prev.map((v) => v.id === item.id ? { ...v, pinned: next } : v));
          const res = await videoService.togglePin(item.videoId, next);
          if (!isMounted.current) return;
          if (!res.success) {
            setFeed((prev) => prev.map((v) => v.id === item.id ? { ...v, pinned: !next } : v));
            Alert.alert('Could not update pin', res.message || 'Try again later.');
          }
        },
      },
      {
        text: 'Delete video',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Delete video',
            'This will permanently remove the video. This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                  let removed = null;
                  let removedAt = -1;
                  setFeed((prev) => {
                    removedAt = prev.findIndex((v) => v.id === item.id);
                    removed   = removedAt >= 0 ? prev[removedAt] : null;
                    return prev.filter((v) => v.id !== item.id);
                  });
                  const res = await videoService.deleteVideo(item.videoId);
                  if (!isMounted.current) return;
                  if (!res.success && removed) {
                    setFeed((prev) => {
                      const next = [...prev];
                      next.splice(Math.max(0, removedAt), 0, removed);
                      return next;
                    });
                    Alert.alert('Delete failed', res.message || 'Try again later.');
                  }
                },
              },
            ],
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ];

    const guestOptions = [
      { text: 'Report', style: 'destructive', onPress: () => Alert.alert('Reported', 'Thanks — we\'ll review this content.') },
      { text: 'Share', onPress: async () => { try { await Share.share({ message: `Check out "${item.title || ''}"`, url: item.uri || '' }); if (item.videoId) videoService.shareVideo(item.videoId); } catch {} } },
      { text: 'Cancel', style: 'cancel' },
    ];

    Alert.alert(
      isOwner ? 'Video options' : 'More',
      undefined,
      isOwner ? ownerOptions : guestOptions,
    );
  }, [authUser?._id, navigation]);

  // Stable referential identity for renderItem so VideoItem doesn't re-mount each render.
  const renderItem = useCallback(({ item, index }) => (
    <VideoItem
      item={item}
      isActive={index === activeIndex && !showComments}
      isFocused={isFocused}
      onOpenComments={() => setShowComments(true)}
      tabOffset={tabOffset}
      onMore={handleMore}
    />
  ), [activeIndex, showComments, isFocused, handleMore, tabOffset]);

  // Safe key extraction — prefer stable id, fall back to index for legacy items.
  const keyExtractor = useCallback(
    (item, index) => (item?.id ? String(item.id) : `idx-${index}`),
    [],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // EARLY RETURNS — all hooks above are guaranteed to run on every render.
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color="white" />
        <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 14 }}>Loading videos…</Text>
      </View>
    );
  }

  // Deep-linked video the viewer can't see (private account, blocked, deleted).
  if (unavailable) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Ionicons name="eye-off-outline" size={48} color="rgba(255,255,255,0.6)" />
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 14 }}>This video isn't available</Text>
        <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
          It may be private, deleted, or from an account you can't view.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          style={{ marginTop: 18, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22, backgroundColor: '#3b82f6' }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error && feed.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Ionicons name="cloud-offline-outline" size={48} color="rgba(255,255,255,0.6)" />
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 14 }}>Couldn't load videos</Text>
        <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 6, textAlign: 'center' }}>{error}</Text>
        <TouchableOpacity
          onPress={() => loadFeed(1, true)}
          activeOpacity={0.85}
          style={{ marginTop: 18, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22, backgroundColor: '#3b82f6' }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!feed.length) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Ionicons name="videocam-off-outline" size={48} color="rgba(255,255,255,0.4)" />
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 14 }}>No videos available</Text>
        <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>Pull down to refresh</Text>
      </View>
    );
  }

  return (
    <View style={{ flex:1, backgroundColor:'#000' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

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
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
        // Open the player exactly on the tapped tile's video. Because getItemLayout
        // is defined, FlatList can jump immediately without measuring rows.
        initialScrollIndex={safeInitialIndex}
        // Render enough items up-front so the target row is mounted on first paint.
        initialNumToRender={Math.max(safeInitialIndex + 1, 1)}
        // Defensive fallback — if a measurement glitch ever fires, scroll manually.
        onScrollToIndexFailed={(info) => {
          const offset = height * info.index;
          flatListRef.current?.scrollToOffset?.({ offset, animated: false });
        }}
        scrollEnabled={!showComments}
        windowSize={3}
        maxToRenderPerBatch={2}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore
            ? <View style={{ height, backgroundColor:'#000', alignItems:'center', justifyContent:'center' }}>
                <ActivityIndicator color="white" />
              </View>
            : null
        }
        ListEmptyComponent={
          <View style={{ height, backgroundColor:'#000', alignItems:'center', justifyContent:'center' }}>
            <Ionicons name="videocam-off-outline" size={48} color="#475569" />
            <Text style={{ color:'#94a3b8', marginTop:12, fontSize:15 }}>No videos yet</Text>
            <Text style={{ color:'#64748b', marginTop:6, fontSize:13 }}>Upload your first video to get started</Text>
          </View>
        }
      />

      <CommentsSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        videoId={feed[activeIndex]?._id || feed[activeIndex]?.id}
        commentCount={feed[activeIndex]?.commentsCount ?? feed[activeIndex]?.comments ?? 0}
        isExternal={!!feed[activeIndex]?.source && feed[activeIndex].source !== 'truevision'}
        allowComments={feed[activeIndex]?.allowComments !== false}
        tabOffset={insets.bottom > 0 ? insets.bottom : Platform.select({ ios: 8, android: 8 })}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({

  // Video overlays
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center' },
  pauseFlash:     { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center' },
  pauseFlashBg:   { backgroundColor:'rgba(0,0,0,0.38)', borderRadius:50, padding:16 },

  // Mute button (top-right)
  muteBtn:      { position:'absolute', right:14, zIndex:30 },
  muteBtnInner: {
    width:40, height:40, borderRadius:20,
    backgroundColor:'rgba(0,0,0,0.42)',
    alignItems:'center', justifyContent:'center',
  },

  // Progress bar
  progressTrack: { position:'absolute', left:0, right:0, height:2, backgroundColor:'rgba(255,255,255,0.22)', zIndex:20 },
  progressFill:  { height:'100%', backgroundColor:'white' },

  // RIGHT action column — Instagram style
  actionCol: {
    position:'absolute', right:12,
    alignItems:'center',
    zIndex:20,
  },
  actionItem: {
    alignItems:'center',
    marginBottom:18,
  },
  actionLabel: {
    color:'white',
    fontSize:12,
    fontWeight:'700',
    marginTop:4,
    textShadowColor:'rgba(0,0,0,0.55)',
    textShadowRadius:3,
  },

  // Spinning disc
  discOuter: {
    width:44, height:44, borderRadius:22,
    borderWidth:2.5, borderColor:'white',
    overflow:'hidden', backgroundColor:'#111',
  },
  discImg: { width:'100%', height:'100%' },
  discHole: {
    position:'absolute', width:10, height:10, borderRadius:5,
    backgroundColor:'#111', borderWidth:1, borderColor:'#555',
    top:'50%', left:'50%', marginTop:-5, marginLeft:-5,
  },

  // Bottom info panel
  infoPanel: {
    position:'absolute', left:14, right:70,
    zIndex:20,
  },
  creatorRow:    { flexDirection:'row', alignItems:'center', marginBottom:8, flexWrap:'nowrap' },
  creatorAvatar: {
    width:36, height:36, borderRadius:18,
    borderWidth:2, borderColor:'white',
    marginRight:8, backgroundColor:'#333',
  },
  creatorName: {
    color:'white', fontWeight:'800', fontSize:15, flexShrink:1,
    textShadowColor:'rgba(0,0,0,0.55)', textShadowRadius:3,
  },
  followPill: {
    marginLeft:10, borderWidth:1.5, borderColor:'white',
    borderRadius:20, paddingHorizontal:14, paddingVertical:4,
  },
  followText:    { color:'white', fontSize:13, fontWeight:'700' },
  followingPill: {
    marginLeft:10, borderWidth:1, borderColor:'rgba(255,255,255,0.5)',
    borderRadius:20, paddingHorizontal:14, paddingVertical:4,
  },
  followingText: { color:'rgba(255,255,255,0.8)', fontSize:13, fontWeight:'600' },

  caption:     { color:'white', fontSize:14, lineHeight:21, textShadowColor:'rgba(0,0,0,0.4)', textShadowRadius:3 },
  captionMore: { color:'rgba(255,255,255,0.5)', fontSize:13, marginTop:2 },

  metaRow: { flexDirection:'row', alignItems:'center', marginBottom:8 },
  metaText: { color:'rgba(255,255,255,0.65)', fontSize:12, marginLeft:5 },
  metaDot:  { width:3, height:3, borderRadius:1.5, backgroundColor:'rgba(255,255,255,0.4)', marginHorizontal:7 },

  tickerRow:  { flexDirection:'row', alignItems:'center' },
  tickerClip: { overflow:'hidden', flex:1, marginLeft:6 },
  tickerText: { color:'white', fontSize:13, fontWeight:'500' },

  // Comment sheet
  commentBackdrop: {
    position:'absolute', top:0, bottom:0, left:0, right:0,
    backgroundColor:'rgba(0,0,0,0.4)', zIndex:50,
  },
  commentSheet: {
    position:'absolute', left:0, right:0,
    height:height * 0.68,
    backgroundColor:'white',
    borderTopLeftRadius:22, borderTopRightRadius:22,
    zIndex:100,
  },
  commentHandle:    { width:36, height:4, borderRadius:2, backgroundColor:'#cbd5e1', marginBottom:4 },
  commentHeader:    { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:14 },
  commentTitle:     { color:'#0f172a', fontWeight:'800', fontSize:16 },
  commentCountText: { color:'#64748b', fontWeight:'600', fontSize:14, marginLeft:8 },
  commentDivider:   { height:1, backgroundColor:'#f1f5f9' },
  commentRow:       { flexDirection:'row', paddingHorizontal:20, paddingTop:16, marginBottom:4 },
  commentAvatar:    { width:36, height:36, borderRadius:18, marginRight:12, backgroundColor:'#e2e8f0' },
  commentUser:      { color:'#0f172a', fontSize:13, fontWeight:'700' },
  commentTime:      { color:'#94a3b8', fontSize:12 },
  commentText:      { color:'#334155', fontSize:14, lineHeight:20 },
  commentLikes:     { color:'#94a3b8', fontSize:11, marginLeft:4 },
  commentInputRow:  {
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:16, paddingTop:12,
    borderTopWidth:1, borderTopColor:'#f1f5f9',
    backgroundColor:'white',
  },
  commentInputAvatar: { width:34, height:34, borderRadius:17, marginRight:10, backgroundColor:'#e2e8f0' },
  commentInputBox: {
    flex:1, flexDirection:'row', alignItems:'center',
    backgroundColor:'#f1f5f9', borderRadius:24,
    paddingHorizontal:16, paddingVertical:9,
  },
  commentInput:   { flex:1, color:'#0f172a', fontSize:14 },
  commentPostBtn: { color:'#3b82f6', fontWeight:'800', fontSize:14 },
});