/**
 * VideoPlayerScreen.jsx
 *
 * Instagram Reels layout — pixel-matched to the reference screenshots.
 *
 * Layout (bottom → top):
 *  ┌─────────────────────────────────────────┐
 *  │  Your BottomTabNavigator (white, 65px)  │  ← rendered by navigator, NOT here
 *  ├─────────────────────────────────────────┤
 *  │  Progress bar (2px white line)          │
 *  ├──────────────────────┬──────────────────┤
 *  │  Creator avatar      │  ♥ Like          │
 *  │  @username  [Follow] │  💬 Comment      │
 *  │  Caption text        │  ↩  Repost       │
 *  │  more                │  ✈  Send         │
 *  │  👁 views • duration │  🔖 Save         │
 *  │  ♩ Song ticker       │  ⋮  More         │
 *  │                      │  🎵 Disc         │
 *  ├──────────────────────┴──────────────────┤
 *  │  Full-screen video (cover fit)          │
 *  │  Top-right: 🔊 mute button             │
 *  └─────────────────────────────────────────┘
 *
 * Key points:
 *  • NO custom BottomTabBar in this file — your BottomTabNavigator handles it.
 *  • We measure its height (TAB_BAR_BASE = 65) + insets and push everything up.
 *  • Uses expo-video + useEvent (no expo-av warnings).
 *  • fullscreenOptions replaces deprecated allowsFullscreen.
 */

import React, {
  useState, useRef, useEffect, useCallback,
} from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback,
  StatusBar, Dimensions, FlatList, TextInput,
  KeyboardAvoidingView, Platform, Animated, Image,
  ActivityIndicator, Alert, Share, StyleSheet,
} from 'react-native';

import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent }                  from 'expo';
import { LinearGradient }            from 'expo-linear-gradient';
import { Ionicons }                  from '@expo/vector-icons';
import Slider                        from '@react-native-community/slider';
import { useSafeAreaInsets }         from 'react-native-safe-area-context';
import videoService                  from '../services/VideoService';

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
  const username = v.userId?.username || v.userId?.fullName || 'creator';
  return {
    id:          v._id  || v.id  || String(Math.random()),
    uri:         v.videoUrl || v.uri || '',
    user: {
      name:   username,
      avatar: v.userId?.profileImage || `https://i.pravatar.cc/150?u=${username}`,
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
  };
};

const MOCK_COMMENTS = [
  { id:'c1', user:'jazz_vibes',   avatar:'https://i.pravatar.cc/150?img=10', text:'Absolutely 🔥🔥 keep going!!',           likes:843,  time:'2h' },
  { id:'c2', user:'techwave99',   avatar:'https://i.pravatar.cc/150?img=11', text:'Saved for later 🙌',                     likes:321,  time:'4h' },
  { id:'c3', user:'nora.creates', avatar:'https://i.pravatar.cc/150?img=12', text:'The quality here is INSANE 😭',          likes:1200, time:'6h' },
  { id:'c4', user:'mikewave',     avatar:'https://i.pravatar.cc/150?img=13', text:"Can't stop watching 🔁",                 likes:98,   time:'8h' },
  { id:'c5', user:'skyline_art',  avatar:'https://i.pravatar.cc/150?img=14', text:'Legendary content ✨',                   likes:450,  time:'1d' },
  { id:'c6', user:'pixel_punk',   avatar:'https://i.pravatar.cc/150?img=15', text:'Watching this on repeat 😂',             likes:2100, time:'1d' },
  { id:'c7', user:'luna.visuals', avatar:'https://i.pravatar.cc/150?img=16', text:'Sent this to everyone I know 📸',        likes:560,  time:'2d' },
];

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
const SpinningDisc = ({ avatarUri, paused }) => {
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
        <Image source={{ uri:avatarUri }} style={S.discImg} />
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
// COMMENT SHEET  — Instagram style (white bg, like the reference screenshot)
// ─────────────────────────────────────────────────────────────────────────────
const CommentSheet = ({ visible, onClose, commentCount = 0 }) => {
  const insets  = useSafeAreaInsets();
  const slideY  = useRef(new Animated.Value(height)).current;
  const [comments, setComments] = useState(MOCK_COMMENTS);
  const [text, setText]         = useState('');
  const [likedMap, setLikedMap] = useState({});
  const [count, setCount]       = useState(commentCount);

  useEffect(() => setCount(commentCount), [commentCount]);
  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : height,
      useNativeDriver:true, friction:26, tension:240,
    }).start();
  }, [visible]);

  const post = useCallback(() => {
    if (!text.trim()) return;
    setComments(p => [{
      id:String(Date.now()), user:'you',
      avatar:'https://i.pravatar.cc/150?img=20',
      text:text.trim(), likes:0, time:'now',
    }, ...p]);
    setCount(n => n + 1);
    setText('');
  }, [text]);

  const renderComment = ({ item }) => (
    <View style={S.commentRow}>
      <Image source={{ uri:item.avatar }} style={S.commentAvatar} />
      <View style={{ flex:1 }}>
        <View style={{ flexDirection:'row', alignItems:'center', marginBottom:2 }}>
          <Text style={S.commentUser}>{item.user}</Text>
          <Text style={S.commentTime}>  {item.time}</Text>
        </View>
        <Text style={S.commentText}>{item.text}</Text>
        <TouchableOpacity
          onPress={() => setLikedMap(m => ({ ...m, [item.id]:!m[item.id] }))}
          style={{ flexDirection:'row', alignItems:'center', marginTop:5 }}
        >
          <Ionicons
            name={likedMap[item.id] ? 'heart' : 'heart-outline'}
            size={13}
            color={likedMap[item.id] ? '#e11d48' : '#94a3b8'}
          />
          <Text style={S.commentLikes}>
            {fmt(item.likes + (likedMap[item.id] ? 1 : 0))}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Bottom of sheet sits above our tab bar
  const tabOffset = TAB_BAR_BASE + (insets.bottom > 0 ? insets.bottom : Platform.select({ ios:25, android:10 }));

  return (
    <>
      {visible && (
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={S.commentBackdrop} />
        </TouchableWithoutFeedback>
      )}
      <Animated.View style={[S.commentSheet, {
        bottom: tabOffset,
        transform:[{ translateY:slideY }],
      }]}>
        {/* Drag handle */}
        <View style={{ alignItems:'center', paddingTop:10 }}>
          <View style={S.commentHandle} />
        </View>
        {/* Header */}
        <View style={S.commentHeader}>
          <Text style={S.commentTitle}>Comments</Text>
          <Text style={S.commentCountText}>{fmt(count)}</Text>
          <TouchableOpacity onPress={onClose} style={{ marginLeft:'auto' }}>
            <Ionicons name="close" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>
        <View style={S.commentDivider} />

        <FlatList
          data={comments}
          keyExtractor={i => i.id}
          renderItem={renderComment}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom:8 }}
        />

        {/* Input bar */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[S.commentInputRow, { paddingBottom:Math.max(insets.bottom, 10) }]}>
            <Image source={{ uri:'https://i.pravatar.cc/150?img=20' }} style={S.commentInputAvatar} />
            <View style={S.commentInputBox}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Add a comment…"
                placeholderTextColor="#94a3b8"
                style={S.commentInput}
                returnKeyType="send"
                onSubmitEditing={post}
              />
              {text.trim().length > 0 && (
                <TouchableOpacity onPress={post}>
                  <Text style={S.commentPostBtn}>Post</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE VIDEO ITEM
// ─────────────────────────────────────────────────────────────────────────────
const VideoItem = ({ item, isActive, onOpenComments, tabOffset }) => {

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
      if (status === 'readyToPlay') { setIsReady(true); setDuration(player.duration ?? 0); }
    });
    const s2 = player.addListener('timeUpdate', ({ currentTime:t }) => setCurrentTime(t ?? 0));
    return () => { s1.remove(); s2.remove(); };
  }, [player]);

  // ── Playback control ──────────────────────────────────────────────────────
  const [userPaused, setUserPaused]   = useState(false);
  useEffect(() => {
    if (isActive && !userPaused) player.play();
    else player.pause();
  }, [isActive, userPaused]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isLiked,     setIsLiked]     = useState(false);
  const [isSaved,     setIsSaved]     = useState(false);
  const [isMuted,     setIsMuted]     = useState(false);
  const [isFollowing, setIsFollowing] = useState(item.isFollowing ?? false);
  const [likes,       setLikes]       = useState(item.likes ?? 0);
  const [saves,       setSaves]       = useState(item.saves ?? 0);
  const [captionFull, setCaptionFull] = useState(false);
  const [burst,       setBurst]       = useState({ visible:false, x:0, y:0 });

  const likeAnim  = useRef(new Animated.Value(1)).current;
  const saveAnim  = useRef(new Animated.Value(1)).current;
  const pauseAnim = useRef(new Animated.Value(0)).current;
  const lastTap   = useRef(0);

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

  const handleLike = () => {
    setIsLiked(l => { setLikes(c => l ? c - 1 : c + 1); return !l; });
    bounce(likeAnim);
  };

  const handleSave = () => {
    const next = !isSaved;
    setIsSaved(next);
    setSaves(c => next ? c + 1 : c - 1);
    bounce(saveAnim);
    Alert.alert(next ? 'Saved' : 'Removed', next ? 'Added to your saved collection.' : 'Removed from saved.');
  };

  const handleShare = async () => {
    try { await Share.share({ message:`Check out "${item.title}" by @${creator}`, url:item.uri }); } catch (_) {}
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
  const avatar    = item.user?.avatar || 'https://i.pravatar.cc/150?img=1';
  const song      = item.song         || `Original Sound – ${creator}`;

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
        <TouchableOpacity style={S.actionItem}>
          <Ionicons name="repeat-outline" size={28} color="white" />
          <Text style={S.actionLabel}>{fmt(item.reposts)}</Text>
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
        <TouchableOpacity style={[S.actionItem, { marginBottom:16 }]}>
          <Ionicons name="ellipsis-vertical" size={22} color="white" />
        </TouchableOpacity>

        {/* Spinning music disc */}
        <SpinningDisc avatarUri={avatar} paused={!nowPlaying} />
      </View>

      {/* ── BOTTOM INFO PANEL  (left side, matching screenshot 1 layout) ── */}
      <View style={[S.infoPanel, { bottom: tabOffset + 10 }]}>

        {/* Creator row: avatar • @name • [Follow] */}
        <View style={S.creatorRow}>
          <Image source={{ uri:avatar }} style={S.creatorAvatar} />
          <Text style={S.creatorName} numberOfLines={1}>@{creator}</Text>
          {isFollowing ? (
            <View style={S.followingPill}>
              <Text style={S.followingText}>Following</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setIsFollowing(true)} style={S.followPill}>
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
  const { video }  = route?.params || {};
  const insets     = useSafeAreaInsets();
  const flatListRef = useRef(null);

  const [feed,        setFeed]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showComments,setShowComments]= useState(false);

  // ── Fetch real videos from backend ─────────────────────────────────────────
  const loadFeed = useCallback(async (pageNum, reset = false) => {
    if (reset) setLoading(true); else setLoadingMore(true);

    try {
      const res = await videoService.getFeed(pageNum, 10, 'new');
      if (res.success && res.videos?.length > 0) {
        const mapped = res.videos.map(mapApiVideo).filter(v => !!v.uri);
        setFeed(prev => reset ? mapped : [...prev, ...mapped]);
        setHasMore(pageNum < (res.pagination?.pages ?? 1));
        setPage(pageNum);
      } else {
        if (reset) {
          // No real videos yet — fall back to sample content
          setFeed(buildFeed(video));
          setHasMore(false);
        } else {
          setHasMore(false);
        }
      }
    } catch (_) {
      if (reset) { setFeed(buildFeed(video)); setHasMore(false); }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [video]);

  useEffect(() => { loadFeed(1, true); }, []);

  // If a specific video was deep-linked, scroll to it or prepend it
  useEffect(() => {
    if (!video) return;
    const mapped = mapApiVideo(video);
    if (!mapped.uri) return;
    setFeed(prev => {
      const exists = prev.some(v => v.id === mapped.id);
      return exists ? prev : [mapped, ...prev];
    });
  }, [video]);

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
  const tabOffset = TAB_BAR_BASE + (insets.bottom > 0 ? insets.bottom : Platform.select({ ios:25, android:10 }));

  if (loading) {
    return (
      <View style={{ flex:1, backgroundColor:'#000', alignItems:'center', justifyContent:'center' }}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color="white" />
        <Text style={{ color:'#94a3b8', marginTop:12, fontSize:14 }}>Loading videos…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex:1, backgroundColor:'#000' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <FlatList
        ref={flatListRef}
        data={feed}
        keyExtractor={i => i.id}
        renderItem={({ item, index }) => (
          <VideoItem
            item={item}
            isActive={index === activeIndex && !showComments}
            onOpenComments={() => setShowComments(true)}
            tabOffset={tabOffset}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, i) => ({ length:height, offset:height * i, index:i })}
        scrollEnabled={!showComments}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={1}
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

      <CommentSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        commentCount={feed[activeIndex]?.comments ?? 0}
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