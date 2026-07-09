// components/reel/ReelCard.js  —  Single full-screen reel with video + interactions
//
// Renders both your uploaded videos and external sources (Pixabay).
// For any external item (item.source !== 'truevision'):
//   • likes / saves / shares update local state only — no backend call (the video isn't in our DB)
//   • saves persist to AsyncStorage so they survive reloads
//   • follow is local-only
//   • everything else (UI, animations, comments button, more button) is identical
//
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableWithoutFeedback, TouchableOpacity, Animated, Share, Alert,
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
import InfoButton            from '../video/InfoButton';
import VideoInfoPanel        from '../video/VideoInfoPanel';
import videoService          from '../../services/VideoService';
import { buildFallbackChain } from '../../utils/videoQuality';
import usePreferences        from '../../hooks/usePreferences';

// Local-only save state for external imports (Pixabay etc). Those videos
// aren't in our DB, so we can't persist saves server-side.
const EXTERNAL_SAVES_KEY = '@truevision:external-saves';

const loadSavedSet = async () => {
  try {
    const raw = await AsyncStorage.getItem(EXTERNAL_SAVES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};
const persistSavedSet = async (set) => {
  try { await AsyncStorage.setItem(EXTERNAL_SAVES_KEY, JSON.stringify([...set])); }
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
  // External = anything that isn't an own upload (Pixabay, etc.).
  // External items skip backend mutations: likes/saves/etc. live in local
  // state only because the videos aren't in our database.
  const isExternal = item.source && item.source !== 'truevision';
  const { prefs } = usePreferences();

  // ── Video player with graceful degradation ─────────────────────────────
  //
  // The player walks a fallback chain of URLs:
  //   720p (Cloudinary-eager-derived when saved)
  //     → 480p (URL-based transform, transcodes lazily)
  //     → 360p (Cloudinary-eager-derived when saved)
  //     → raw secureUrl
  //
  // If a URL emits a `status === 'error'` OR the player never reaches
  // `readyToPlay` within LOAD_TIMEOUT_MS, we step to the next rung. When
  // every rung is exhausted we surface an error UI with a Retry button —
  // no more infinite spinner.
  //
  // This is the production-grade safety net for the "newest video hangs"
  // bug: even if Cloudinary's eager transcode has raced past the client's
  // first playback attempt on 720p, the 360p rung (also eager-derived) or
  // the raw secureUrl will succeed.

  const LOAD_TIMEOUT_MS = 12000; // per-rung ceiling

  const chain = useMemo(
    () => buildFallbackChain(item, { dataSaver: prefs?.content?.dataSaver }),
    [item, prefs?.content?.dataSaver],
  );
  const [rung, setRung]         = useState(0);           // index into `chain`
  const [playError, setPlayError] = useState(null);
  const [retryToken, setRetryToken] = useState(0);       // bumps to force fresh player

  const activeUrl = chain[rung] || '';

  const player = useVideoPlayer(activeUrl, (p) => {
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

  // Reset per-URL state whenever the active URL flips (rung advance / retry).
  useEffect(() => {
    setIsReady(false);
    setProgress(0);
    setDuration(0);
  }, [activeUrl, retryToken]);

  // Advance to the next rung if the current one fails or hasn't produced a
  // first frame in LOAD_TIMEOUT_MS. Called from both the timeout effect and
  // the statusChange 'error' branch to keep the recovery path single.
  const stepFallbackOrFail = useCallback((reason) => {
    if (rung + 1 < chain.length) {
      console.warn(`[ReelCard] Playback fallback (${reason}) — ${chain[rung]} → ${chain[rung + 1]}`);
      setRung((r) => r + 1);
    } else {
      console.warn(`[ReelCard] Playback failed after ${chain.length} rungs (${reason})`);
      setPlayError(reason);
    }
  }, [chain, rung]);

  // statusChange listener — expo-video emits 'error' on codec/network failure.
  useEffect(() => {
    const s1 = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'readyToPlay') {
        setIsReady(true);
        setPlayError(null);
        setDuration(player.duration ?? 0);
      } else if (status === 'error') {
        stepFallbackOrFail(error?.message || 'Playback error');
      }
    });
    const s2 = player.addListener('timeUpdate', ({ currentTime }) => {
      const t = currentTime ?? 0;
      setProgress(duration > 0 ? t / duration : 0);
    });
    // playbackError is a separate channel on some player versions.
    let s3;
    try {
      s3 = player.addListener('playbackError', (evt) => {
        stepFallbackOrFail(evt?.message || 'Playback error');
      });
    } catch (_) { /* older expo-video without this event */ }
    return () => { s1.remove(); s2.remove(); s3?.remove(); };
  }, [player, duration, stepFallbackOrFail]);

  // Loading-timeout effect: if the current rung hasn't reached readyToPlay
  // within LOAD_TIMEOUT_MS, step to the next rung. Only runs when the row
  // is actually meant to be playing (visible + focused).
  useEffect(() => {
    if (isReady || playError || !activeUrl || !isActive || !isFocused) return;
    const t = setTimeout(() => stepFallbackOrFail('load-timeout'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [isReady, playError, activeUrl, isActive, isFocused, retryToken, stepFallbackOrFail]);

  // Manual retry — reset to the primary rung, bump the token so the player
  // effect re-fires even if `activeUrl` is unchanged.
  const retryPlayback = useCallback(() => {
    setPlayError(null);
    setRung(0);
    setRetryToken((n) => n + 1);
  }, []);

  // Play/pause based on viewability AND screen focus.
  // isFocused becomes false when the user navigates to another tab — that
  // pauses the video and prevents background playback.
  const [userPaused, setUserPaused] = useState(false);
  useEffect(() => {
    if (isActive && isFocused && !userPaused && !playError) player.play();
    else player.pause();
  }, [isActive, isFocused, userPaused, playError, player]);

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
  const [showInfo,    setShowInfo]    = useState(false);

  // Hydrate persisted save state for external (non-own-upload) videos
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
      const url = item.videoUrl || '';
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

          {/* Loading spinner — hidden once we surface an error card so the
              spinner never fights the retry UI. */}
          {!isReady && !playError && (
            <View style={S.loader}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {/* Error card + Retry — replaces the infinite spinner when every
              fallback rung has failed. Tapping Retry resets to the primary
              URL and re-runs the load, giving Cloudinary any extra time it
              still needed to finish the eager transcode. */}
          {playError && (
            <View style={S.errorCard}>
              <Ionicons name="cloud-offline-outline" size={44} color="rgba(255,255,255,0.85)" />
              <Text style={S.errorTitle}>Playback unavailable</Text>
              <Text style={S.errorSub}>The video could not be loaded right now.</Text>
              <TouchableOpacity style={S.retryBtn} onPress={retryPlayback} activeOpacity={0.85}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={S.retryTxt}>Try again</Text>
              </TouchableOpacity>
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

      {/* ── Top-right info button (ⓘ) ──────────────────────────────────── */}
      <View style={S.infoBtnWrap} pointerEvents="box-none">
        <InfoButton onPress={() => setShowInfo(true)} />
      </View>

      {/* ── Three-dot menu sheet ──────────────────────────────────────── */}
      <MoreSheet
        visible={showMore}
        item={item}
        onClose={() => setShowMore(false)}
        onHide={(it, reason) => onHide?.(it, reason)}
      />

      {/* ── Info panel (Fact / News / Opinion) ────────────────────────── */}
      <VideoInfoPanel
        visible={showInfo}
        onClose={() => setShowInfo(false)}
        video={item}
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

  // ⓘ button — top-right, safe-area-friendly (matches status-bar inset on
  // most devices without needing useSafeAreaInsets in this component).
  infoBtnWrap:  { position: 'absolute', top: 56, right: 14, zIndex: 25 },

  // Playback-error card + retry — sits centre-screen over the video so the
  // thumbnail behind it still hints at the video contents.
  errorCard:  {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 14 },
  errorSub:   { color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 6, textAlign: 'center' },
  retryBtn:   {
    marginTop: 18, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  retryTxt:   { color: '#fff', fontWeight: '700', marginLeft: 8, fontSize: 14 },
});
