// truevision/components/reel/PexelsReelCard.js
//
// Slim full-screen reel for Pexels videos. Differs from ReelCard.js because:
//   - No backend social state (Pexels videos aren't in our DB)
//   - Likes are local-only (UI feedback, not persisted)
//   - Thumbnail shown via expo-image while video loads (built-in caching)
//
// Renders inside a vertically-paged FlatList — see PexelsReelsScreen.

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableWithoutFeedback, TouchableOpacity, Animated, Share,
  StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent }       from 'expo';
import { Image }          from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// ─── Heart burst on double tap ───────────────────────────────────────────────
const HeartBurst = ({ visible, x, y }) => {
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    scale.setValue(0); opacity.setValue(1);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, friction: 4 }),
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible, x, y]);
  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: x - 45, top: y - 45,
      width: 90, height: 90, alignItems: 'center', justifyContent: 'center',
      transform: [{ scale }], opacity, zIndex: 999,
    }}>
      <Ionicons name="heart" size={80} color="#fff" />
    </Animated.View>
  );
};

// ─── Side action button ──────────────────────────────────────────────────────
const SideButton = ({ icon, label, onPress, color = '#fff', filled }) => (
  <TouchableOpacity onPress={onPress} style={S.sideBtn} activeOpacity={0.7}>
    <Ionicons name={icon} size={32} color={filled ? '#ef4444' : color} />
    {label != null && <Text style={S.sideLabel}>{label}</Text>}
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────────────────────────
export default function PexelsReelCard({ item, isActive, isFocused = true, bottomOffset = 0 }) {
  const player = useVideoPlayer(item.videoUrl, (p) => {
    p.loop  = true;
    p.muted = false;
    if ('bufferOptions' in p) {
      try {
        p.bufferOptions = {
          preferredForwardBufferDuration: 4,
          minBufferForPlayback: 1,
          waitsToMinimizeStalling: false,
        };
      } catch {}
    }
  });
  useEvent(player, 'playingChange', { isPlaying: player.playing });

  const [isReady, setIsReady]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [duration, setDuration]   = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [isLiked, setIsLiked]     = useState(false);
  const [likes, setLikes]         = useState(0);

  // Track playback ready/progress
  useEffect(() => {
    const s1 = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        setIsReady(true);
        setDuration(player.duration ?? 0);
      }
    });
    const s2 = player.addListener('timeUpdate', ({ currentTime }) => {
      const t = currentTime ?? 0;
      setProgress(duration > 0 ? t / duration : 0);
    });
    return () => { s1.remove(); s2.remove(); };
  }, [player, duration]);

  // Autoplay when active AND the screen is focused (no background playback)
  useEffect(() => {
    if (isActive && isFocused && !userPaused) player.play();
    else player.pause();
  }, [isActive, isFocused, userPaused, player]);

  // ── Tap handling ────────────────────────────────────────────────────────
  const [burst, setBurst] = useState({ visible: false, x: 0, y: 0 });
  const pauseAnim         = useRef(new Animated.Value(0)).current;
  const lastTap           = useRef(0);

  const handleTap = useCallback((evt) => {
    const now = Date.now();
    const { locationX, locationY } = evt.nativeEvent;

    if (now - lastTap.current < 280) {
      if (!isLiked) {
        setIsLiked(true);
        setLikes((l) => l + 1);
      }
      setBurst({ visible: false, x: locationX, y: locationY });
      setTimeout(() => setBurst({ visible: true, x: locationX, y: locationY }), 10);
    } else {
      setUserPaused((p) => {
        pauseAnim.setValue(1);
        Animated.timing(pauseAnim, { toValue: 0, duration: 600, delay: 300, useNativeDriver: true }).start();
        return !p;
      });
    }
    lastTap.current = now;
  }, [isLiked, pauseAnim]);

  const handleLike = () => {
    setIsLiked((prev) => {
      setLikes((l) => prev ? Math.max(0, l - 1) : l + 1);
      return !prev;
    });
  };

  const handleShare = async () => {
    try {
      const url = item.pexelsUrl || item.videoUrl;
      await Share.share({ message: `Check out this video on TrueVision\n${url}` });
    } catch {}
  };

  return (
    <View style={S.root}>
      {/* ── Thumbnail underneath (visible until video is ready) ─────────── */}
      {item.thumbnailUrl ? (
        <Image
          source={{ uri: item.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : null}

      {/* ── Video ──────────────────────────────────────────────────────── */}
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={StyleSheet.absoluteFill}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit={item.isVertical ? 'cover' : 'contain'}
            nativeControls={false}
          />

          <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent']} style={S.gradTop} pointerEvents="none" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={[S.gradBot, { height: bottomOffset + 200 }]} pointerEvents="none" />

          {!isReady && (
            <View style={S.loader}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          <Animated.View pointerEvents="none" style={[S.pauseFlash, { opacity: pauseAnim }]}>
            <View style={S.pauseBg}>
              <Ionicons name={userPaused ? 'play' : 'pause'} size={36} color="#fff" />
            </View>
          </Animated.View>

          <HeartBurst visible={burst.visible} x={burst.x} y={burst.y} />
        </View>
      </TouchableWithoutFeedback>

      {/* ── Progress bar ────────────────────────────────────────────────── */}
      <View style={[S.progressTrack, { bottom: bottomOffset }]}>
        <View style={[S.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
      </View>

      {/* ── Side actions ────────────────────────────────────────────────── */}
      <View style={[S.sideCol, { bottom: bottomOffset + 90 }]}>
        <SideButton icon={isLiked ? 'heart' : 'heart-outline'} label={likes || ''} onPress={handleLike} filled={isLiked} />
        <SideButton icon="share-social-outline" label="Share" onPress={handleShare} />
      </View>

      {/* ── Caption ─────────────────────────────────────────────────────── */}
      <View style={[S.caption, { bottom: bottomOffset + 16 }]}>
        <Text style={S.captionUser}>@{item.creator?.name || 'pexels'}</Text>
        <Text style={S.captionMeta}>via Pexels · {Math.round(item.duration || 0)}s</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:         { width, height, backgroundColor: '#000' },
  gradTop:      { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },
  gradBot:      { position: 'absolute', bottom: 0, left: 0, right: 0 },
  loader:       { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  pauseFlash:   { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  pauseBg:      { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 50, padding: 16 },

  progressTrack:{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.2)', zIndex: 20 },
  progressFill: { height: '100%', backgroundColor: '#fff' },

  sideCol:      { position: 'absolute', right: 12, alignItems: 'center' },
  sideBtn:      { alignItems: 'center', marginVertical: 12 },
  sideLabel:    { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 },

  caption:      { position: 'absolute', left: 16, right: 80 },
  captionUser:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  captionMeta:  { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
});
