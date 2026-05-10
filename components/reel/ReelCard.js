// components/reel/ReelCard.js  —  Single full-screen reel with video + interactions
//
// Renders both your uploaded videos and external sources (Pixabay / Pexels).
// For any external item (item.source !== 'truevision'):
//   • likes / saves / shares update local state only — no backend call (the video isn't in our DB)
//   • saves persist to AsyncStorage so they survive reloads
//   • follow is local-only
//   • everything else (UI, animations, comments button, more button) is identical
//
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, TouchableWithoutFeedback, Animated, Share, Alert,
  StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import AsyncStorage          from '@react-native-async-storage/async-storage';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image as ExpoImage } from 'expo-image';
import { useEvent }          from 'expo';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import ActionButtons         from './ActionButtons';
import CaptionSection        from './CaptionSection';
import MoreSheet             from './MoreSheet';
import videoService          from '../../services/VideoService';
import { pickVideoUrl }      from '../../utils/videoQuality';
import usePreferences        from '../../hooks/usePreferences';

const PEXELS_SAVES_KEY = '@truevision:pexels-saves';

// Read/write the persisted set of saved Pexels video IDs.
const loadSavedSet = async () => {
  try {
    const raw = await AsyncStorage.getItem(PEXELS_SAVES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};
const persistSavedSet = async (set) => {
  try { await AsyncStorage.setItem(PEXELS_SAVES_KEY, JSON.stringify([...set])); }
  catch {}
};

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
export default function ReelCard({ item, isActive, isFocused = true, onOpenComments, onHide, bottomOffset }) {
  // External = anything that isn't an own upload (Pixabay, Pexels, etc.).
  // External items skip backend mutations: likes/saves/etc. live in local
  // state only because the videos aren't in our database.
  const isExternal = item.source && item.source !== 'truevision';
  const { prefs } = usePreferences();

  // ── Video player ────────────────────────────────────────────────────────
  // Prefer a Cloudinary-encoded 720p (or 480p in data saver) for our own
  // uploads instead of the raw 4K original. Pexels items keep their pre-picked
  // URL. Falls back gracefully when no quality ladder is present.
  const videoUrl = pickVideoUrl(item, { dataSaver: prefs?.content?.dataSaver });

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop  = true;
    p.muted = false;
    // Smaller forward buffer = faster first frame. Player keeps fetching after start.
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

  // Play/pause based on viewability AND screen focus.
  // isFocused becomes false when the user navigates to another tab — that
  // pauses the video and prevents background playback.
  const [userPaused, setUserPaused] = useState(false);
  useEffect(() => {
    if (isActive && isFocused && !userPaused) player.play();
    else player.pause();
  }, [isActive, isFocused, userPaused, player]);

  // ── Social state ────────────────────────────────────────────────────────
  const [isLiked,     setIsLiked]     = useState(item.isLiked     ?? false);
  const [isSaved,     setIsSaved]     = useState(item.isSaved     ?? false);
  const [isReposted,  setIsReposted]  = useState(item.isReposted  ?? false);
  const [isFollowing, setIsFollowing] = useState(item.isFollowing ?? false);
  const [likes,       setLikes]       = useState(item.likesCount   ?? item.likes   ?? 0);
  const [saves,       setSaves]       = useState(item.savesCount   ?? item.saves   ?? 0);
  const [shares,      setShares]      = useState(item.sharesCount  ?? item.shares  ?? 0);
  const [reposts,     setReposts]     = useState(item.repostsCount ?? item.reposts ?? 0);
  const [showMore,    setShowMore]    = useState(false);

  // Hydrate persisted save state for Pexels videos
  useEffect(() => {
    if (!isExternal) return;
    let alive = true;
    loadSavedSet().then((set) => {
      if (alive && set.has(item._id || item.id)) setIsSaved(true);
    });
    return () => { alive = false; };
  }, [isExternal, item._id, item.id]);

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
        if (!isExternal) videoService.toggleLike(item._id || item.id);
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
  }, [isLiked, item._id, item.id, isExternal, pauseAnim]);

  // ── Action handlers ─────────────────────────────────────────────────────
  const handleLike = () => {
    const next = !isLiked;
    setIsLiked(next);
    setLikes(l => Math.max(0, next ? l + 1 : l - 1));
    if (!isExternal) videoService.toggleLike(item._id || item.id);
  };

  const handleSave = async () => {
    const next = !isSaved;
    setIsSaved(next);
    setSaves(s => Math.max(0, next ? s + 1 : s - 1));
    if (isExternal) {
      const set = await loadSavedSet();
      if (next) set.add(item._id || item.id);
      else      set.delete(item._id || item.id);
      persistSavedSet(set);
    } else {
      videoService.toggleSave(item._id || item.id);
    }
  };

  const handleShare = async () => {
    try {
      const url = item.pexelsUrl || item.videoUrl || '';
      const message = `Check out @${creator} on TrueVision${url ? `\n${url}` : ''}`;
      await Share.share({ message });
      setShares((s) => s + 1);
      if (!isExternal) videoService.shareVideo(item._id || item.id);
    } catch {}
  };

  const handleRepost = async () => {
    if (isExternal) {
      Alert.alert('Repost unavailable', "Stock videos from external sources can't be reposted.");
      return;
    }
    const next = !isReposted;
    // Optimistic update — flip immediately
    setIsReposted(next);
    setReposts((c) => Math.max(0, next ? c + 1 : c - 1));

    const res = await videoService.toggleRepost(item._id || item.id);
    if (!res.success) {
      // Revert on failure
      setIsReposted(!next);
      setReposts((c) => Math.max(0, !next ? c + 1 : c - 1));
      Alert.alert('Could not update repost', res.message || 'Try again later.');
      return;
    }
    // Honour the server's authoritative state if it disagrees
    if (typeof res.reposted === 'boolean' && res.reposted !== next) {
      setIsReposted(res.reposted);
    }
    if (typeof res.repostsCount === 'number') setReposts(res.repostsCount);
  };

  const handleFollow = () => {
    setIsFollowing(true);
    // Persistence for follow is part of the (future) follow API — local only for now.
  };

  // ── Derived ─────────────────────────────────────────────────────────────
  const creator      = item.userId?.username || item.user?.name || 'creator';
  const creatorName  = item.userId?.fullName || item.userId?.username || creator;
  const avatar       = item.userId?.profileImage || item.user?.avatar || null; // null → initials fallback
  const song         = item.song || (isExternal ? '' : `Original Sound – ${creator}`);
  const caption      = item.description || '';
  const commentCount = item.commentsCount ?? item.comments ?? 0;
  const isVerified   = item.userId?.isVerified ?? false;

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>

      {/* ── Thumbnail behind the video while it buffers ─────────────────── */}
      {item.thumbnailUrl ? (
        <ExpoImage
          source={{ uri: item.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : null}

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
        avatarName={creatorName}
        likes={likes}
        comments={commentCount}
        shares={shares}
        saves={saves}
        reposts={reposts}
        isLiked={isLiked}
        isSaved={isSaved}
        isReposted={isReposted}
        onLike={handleLike}
        onComment={onOpenComments}
        onShare={handleShare}
        onSave={handleSave}
        onRepost={handleRepost}
        onMore={() => setShowMore(true)}
        onAvatarPress={() => {}}
        style={{ bottom: bottomOffset + 100 }}
      />

      {/* ── Bottom info ───────────────────────────────────────────────── */}
      <CaptionSection
        username={creator}
        caption={caption}
        song={song}
        isFollowing={isFollowing}
        isVerified={isVerified}
        onFollow={handleFollow}
        style={{ bottom: bottomOffset + 14 }}
      />

      {/* ── Three-dot menu sheet ──────────────────────────────────────── */}
      <MoreSheet
        visible={showMore}
        item={item}
        onClose={() => setShowMore(false)}
        onHide={(it, reason) => onHide?.(it, reason)}
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
