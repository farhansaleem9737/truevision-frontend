// components/reel/ReelCard.js  —  Single full-screen reel with video + interactions
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, TouchableWithoutFeedback, Animated, Share, Alert,
  StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent }          from 'expo';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import ActionButtons         from './ActionButtons';
import CaptionSection        from './CaptionSection';
import videoService          from '../../services/VideoService';

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

// ─────────────────────────────────────────────────────────────────────────────
export default function ReelCard({ item, isActive, onOpenComments, bottomOffset }) {
  // ── Video player ────────────────────────────────────────────────────────
  const videoUrl = item.videoUrl || item.uri || '';

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop  = true;
    p.muted = false;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

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

  // Play/pause based on visibility
  const [userPaused, setUserPaused] = useState(false);
  useEffect(() => {
    if (isActive && !userPaused) player.play();
    else player.pause();
  }, [isActive, userPaused]);

  // ── Social state ────────────────────────────────────────────────────────
  const [isLiked,     setIsLiked]     = useState(item.isLiked     ?? false);
  const [isSaved,     setIsSaved]     = useState(item.isSaved     ?? false);
  const [isFollowing, setIsFollowing] = useState(item.isFollowing ?? false);
  const [likes,       setLikes]       = useState(item.likesCount  ?? item.likes ?? 0);
  const [saves,       setSaves]       = useState(item.savesCount  ?? item.saves ?? 0);

  // ── Tap handling (single = pause, double = like) ────────────────────────
  const [burst, setBurst]   = useState({ visible: false, x: 0, y: 0 });
  const pauseAnim           = useRef(new Animated.Value(0)).current;
  const lastTap             = useRef(0);

  const handleTap = useCallback((evt) => {
    const now = Date.now();
    const { locationX, locationY } = evt.nativeEvent;

    if (now - lastTap.current < 280) {
      // Double tap → like
      if (!isLiked) {
        setIsLiked(true);
        setLikes(l => l + 1);
        videoService.toggleLike(item._id || item.id);
      }
      setBurst({ visible: false, x: locationX, y: locationY });
      setTimeout(() => setBurst({ visible: true, x: locationX, y: locationY }), 10);
    } else {
      // Single tap → pause/play
      setUserPaused(p => {
        pauseAnim.setValue(1);
        Animated.timing(pauseAnim, { toValue: 0, duration: 600, delay: 300, useNativeDriver: true }).start();
        return !p;
      });
    }
    lastTap.current = now;
  }, [isLiked, item._id, item.id]);

  // ── Action handlers ─────────────────────────────────────────────────────
  const handleLike = () => {
    const next = !isLiked;
    setIsLiked(next);
    setLikes(l => next ? l + 1 : l - 1);
    videoService.toggleLike(item._id || item.id);
  };

  const handleSave = () => {
    const next = !isSaved;
    setIsSaved(next);
    setSaves(s => next ? s + 1 : s - 1);
    videoService.toggleSave(item._id || item.id);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out this video by @${creator} on TrueVision!` });
      videoService.shareVideo(item._id || item.id);
    } catch (_) {}
  };

  const handleFollow = () => {
    setIsFollowing(true);
  };

  // ── Derived ─────────────────────────────────────────────────────────────
  const creator = item.userId?.username || item.user?.name || 'creator';
  const avatar  = item.userId?.profileImage || item.user?.avatar || 'https://i.pravatar.cc/150?img=1';
  const song    = item.song || `Original Sound – ${creator}`;
  const caption = item.description || '';
  const commentCount = item.commentsCount ?? item.comments ?? 0;
  const shareCount   = item.sharesCount   ?? item.shares   ?? 0;

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>

      {/* ── Video ─────────────────────────────────────────────────────── */}
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={StyleSheet.absoluteFill}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />

          {/* Top gradient */}
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'transparent']}
            style={S.gradTop} pointerEvents="none"
          />
          {/* Bottom gradient */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={[S.gradBot, { height: bottomOffset + 220 }]} pointerEvents="none"
          />

          {/* Loading spinner */}
          {!isReady && (
            <View style={S.loader}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {/* Pause/play flash */}
          <Animated.View pointerEvents="none" style={[S.pauseFlash, { opacity: pauseAnim }]}>
            <View style={S.pauseBg}>
              <Ionicons name={userPaused ? 'play' : 'pause'} size={36} color="#fff" />
            </View>
          </Animated.View>

          {/* Heart burst */}
          <HeartBurst visible={burst.visible} x={burst.x} y={burst.y} />
        </View>
      </TouchableWithoutFeedback>

      {/* ── Progress bar ──────────────────────────────────────────────── */}
      <View style={[S.progressTrack, { bottom: bottomOffset }]}>
        <View style={[S.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
      </View>

      {/* ── Right action column ───────────────────────────────────────── */}
      <ActionButtons
        avatarUri={avatar}
        likes={likes}
        comments={commentCount}
        shares={shareCount}
        saves={saves}
        isLiked={isLiked}
        isSaved={isSaved}
        onLike={handleLike}
        onComment={onOpenComments}
        onShare={handleShare}
        onSave={handleSave}
        onMore={() => {}}
        onAvatarPress={() => {}}
        style={{ bottom: bottomOffset + 100 }}
      />

      {/* ── Bottom info ───────────────────────────────────────────────── */}
      <CaptionSection
        username={creator}
        caption={caption}
        song={song}
        isFollowing={isFollowing}
        onFollow={handleFollow}
        style={{ bottom: bottomOffset + 14 }}
      />
    </View>
  );
}

const S = StyleSheet.create({
  gradTop:      { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  gradBot:      { position: 'absolute', bottom: 0, left: 0, right: 0 },
  loader:       { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  pauseFlash:   { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  pauseBg:      { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 50, padding: 16 },
  progressTrack:{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.2)', zIndex: 20 },
  progressFill: { height: '100%', backgroundColor: '#fff' },
});
