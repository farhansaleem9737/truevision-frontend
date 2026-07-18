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
import * as FileSystem       from 'expo-file-system';
import { useNavigation }     from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image as ExpoImage } from 'expo-image';
import { useEvent }          from 'expo';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import ActionButtons         from './ActionButtons';
import CaptionSection        from './CaptionSection';
import MoreSheet             from './MoreSheet';
import ManageReelSheet       from './ManageReelSheet';
import InfoButton            from '../video/InfoButton';
import VideoInfoPanel        from '../video/VideoInfoPanel';
import videoService          from '../../services/VideoService';
import userService           from '../../services/UserService';
import { buildFallbackChain } from '../../utils/videoQuality';
import usePreferences        from '../../hooks/usePreferences';
import useNetworkStatus      from '../../hooks/useNetworkStatus';
import { useAuth }           from '../../context/AuthContext';

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
  const { user }  = useAuth();
  const navigation = useNavigation();
  const net = useNetworkStatus();

  // ── Content-preference driven playback ─────────────────────────────────
  // autoplay OFF  → videos never start on their own; the user taps play.
  // hdOnWifi ON   → on cellular we behave like Data Saver (lower rungs first).
  // dataSaver ON  → always prefer smaller rungs.
  const autoplayPref   = prefs?.content?.autoplay !== false; // default ON
  const dataSaverPref  = prefs?.content?.dataSaver === true;
  const hdOnWifiPref   = prefs?.content?.hdOnWifi !== false;  // default ON
  // "HD on Wi-Fi only" means: throttle when NOT on Wi-Fi.
  const cellularThrottle = hdOnWifiPref && net.isCellular;
  const effectiveDataSaver = dataSaverPref || cellularThrottle;

  // Owner detection — the "Manage your reel" sheet is only ever shown for
  // videos this user uploaded. External videos are never owned.
  const ownerId  = item.userId?._id || item.userId;
  const isOwner  = !isExternal && !!user?._id && !!ownerId && String(user._id) === String(ownerId);

  // Mirror the mutable owner-facing flags so the sheet's toggles reflect
  // reality instantly. Falls back to the item's own values when the sheet
  // is first opened.
  const [ownerFlags, setOwnerFlags] = useState({
    allowComments:  item.allowComments  === undefined ? true : !!item.allowComments,
    allowDownload:  item.allowDownload  === undefined ? true : !!item.allowDownload,
    pinned:         !!item.pinned,
    hideLikeCount:  !!item.hideLikeCount,
    hideShareCount: !!item.hideShareCount,
    isArchived:     !!item.isArchived,
  });

  // Memoized merge for the sheet's `video` prop — without this a fresh
  // object literal is produced every render, which retriggers the sheet's
  // sync-effect mid-toggle and can overwrite in-flight optimistic state.
  const sheetVideo = useMemo(() => ({ ...item, ...ownerFlags }), [item, ownerFlags]);

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
    () => buildFallbackChain(item, { dataSaver: effectiveDataSaver }),
    [item, effectiveDataSaver],
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

  // ── Auto-play preference gate ──────────────────────────────────────────
  // When autoplay is OFF, a video that scrolls into view must NOT start on
  // its own — the user taps to begin. `manualStart` records that explicit tap
  // and resets every time a NEW video becomes active, so the gate re-arms per
  // reel. When autoplay is ON this has no effect.
  const [manualStart, setManualStart] = useState(false);
  useEffect(() => {
    // Re-arm the gate whenever this card becomes the active one.
    if (isActive && !autoplayPref) setManualStart(false);
  }, [isActive, autoplayPref]);

  const allowedToPlay = autoplayPref || manualStart;

  useEffect(() => {
    if (isActive && isFocused && !userPaused && !playError && allowedToPlay) player.play();
    else player.pause();
  }, [isActive, isFocused, userPaused, playError, allowedToPlay, player]);

  // ── Social state ────────────────────────────────────────────────────────
  const [isLiked,     setIsLiked]     = useState(item.isLiked     ?? false);
  const [isSaved,     setIsSaved]     = useState(item.isSaved     ?? false);
  const [isReposted,  setIsReposted]  = useState(item.isReposted  ?? false);
  // Follow is three-state: 'none' | 'following' | 'requested' (private accounts).
  const [followStatus, setFollowStatus] = useState(item.isFollowing ? 'following' : 'none');
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
      // Single tap → play/pause.
      // If autoplay is off and this reel hasn't been manually started yet, the
      // first tap STARTS it (satisfies the gate) rather than toggling pause.
      if (!autoplayPref && !manualStart) {
        setManualStart(true);
        pauseAnim.setValue(1);
        Animated.timing(pauseAnim, { toValue: 0, duration: 600, delay: 300, useNativeDriver: true }).start();
      } else {
        setUserPaused(p => {
          pauseAnim.setValue(1);
          Animated.timing(pauseAnim, { toValue: 0, duration: 600, delay: 300, useNativeDriver: true }).start();
          return !p;
        });
      }
    }
    lastTap.current = now;
  }, [isLiked, item._id, item.id, isExternal, pauseAnim, autoplayPref, manualStart]);

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

  const handleFollow = async () => {
    if (isOwner || followStatus !== 'none') return;
    // External/stock videos have no TrueVision account behind them — keep the
    // old local-only behaviour so the button still responds.
    if (isExternal || !ownerId) { setFollowStatus('following'); return; }
    const prev = followStatus;
    setFollowStatus('following'); // optimistic — server may downgrade to 'requested'
    const res = await userService.followUser(String(ownerId));
    if (res?.success) {
      setFollowStatus(res.status === 'requested' ? 'requested' : 'following');
    } else {
      setFollowStatus(prev);
      Alert.alert('Could not follow', res?.message || 'Try again later.');
    }
  };

  // ── Owner-only "Manage your reel" handlers ─────────────────────────────
  // Every toggle handler mutates the local mirror, calls the API, and rolls
  // back on failure. The `resKey` argument is the property the server
  // returns to communicate the authoritative post-toggle value.
  const runOwnerToggle = useCallback(async (flagKey, apiCall, resKey) => {
    const before = ownerFlags[flagKey];
    const next   = !before;
    setOwnerFlags((f) => ({ ...f, [flagKey]: next }));
    const res = await apiCall(item._id || item.id, next);
    if (!res?.success) {
      setOwnerFlags((f) => ({ ...f, [flagKey]: before }));
      Alert.alert('Could not update', res?.message || 'Try again later.');
      throw new Error(res?.message || 'Toggle failed');
    }
    const serverVal = typeof res[resKey] === 'boolean' ? res[resKey] : next;
    if (serverVal !== next) setOwnerFlags((f) => ({ ...f, [flagKey]: serverVal }));
    return { [flagKey]: serverVal };
  }, [item._id, item.id, ownerFlags]);

  const handleOwnerEdit = () => navigation.navigate('EditReel', { video: item });

  // updateVideo returns { video } rather than a top-level boolean; the shim
  // lifts the flag out of the returned doc so runOwnerToggle can return the
  // server-authoritative { [flagKey]: boolean } the sheet expects.
  const handleOwnerToggleComments = () =>
    runOwnerToggle('allowComments',
      async (id, v) => { const r = await videoService.updateVideo(id, { allowComments: v }); return r?.success ? { ...r, allowComments: r.video?.allowComments } : r; },
      'allowComments');

  const handleOwnerToggleDownload = () =>
    runOwnerToggle('allowDownload',
      async (id, v) => { const r = await videoService.updateVideo(id, { allowDownload: v }); return r?.success ? { ...r, allowDownload: r.video?.allowDownload } : r; },
      'allowDownload');

  const handleOwnerTogglePin        = () => runOwnerToggle('pinned',         videoService.togglePin,                    'pinned');
  const handleOwnerToggleHideLikeC  = () => runOwnerToggle('hideLikeCount',  videoService.toggleLikeCountVisibility,    'hideLikeCount');
  const handleOwnerToggleHideShareC = () => runOwnerToggle('hideShareCount', videoService.toggleShareCountVisibility,   'hideShareCount');

  const handleOwnerArchive = async () => {
    const before = ownerFlags.isArchived;
    const next   = !before;
    const res    = await videoService.toggleArchive(item._id || item.id, next);
    if (!res?.success) {
      Alert.alert('Could not update', res?.message || 'Try again later.');
      throw new Error(res?.message || 'Archive failed');
    }
    setOwnerFlags((f) => ({ ...f, isArchived: res.isArchived }));
    // Once archived, pop the video out of the current feed so it isn't
    // sitting there with a confusing "restored?" state.
    if (res.isArchived) onHide?.(item, 'archived');
    return { isArchived: res.isArchived };
  };

  const handleOwnerDownload = async () => {
    // Owner can always save their own reel — allowDownload only gates viewers.
    if (!item.videoUrl) return;
    try {
      const filename = `truevision-${item._id || item.id || Date.now()}.mp4`;
      const target   = `${FileSystem.cacheDirectory}${filename}`;
      Alert.alert('Downloading', 'Saving to your share sheet…');
      const { uri } = await FileSystem.downloadAsync(item.videoUrl, target);
      await Share.share({ url: uri, message: 'Saved video' });
    } catch (e) {
      Alert.alert('Download failed', e.message || 'Try again later.');
    }
  };

  const handleOwnerDelete = async () => {
    const res = await videoService.deleteVideo(item._id || item.id);
    if (!res?.success) {
      Alert.alert('Delete failed', res?.message || 'Try again later.');
      return;
    }
    onHide?.(item, 'deleted');
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

          {/* Auto-play OFF: a persistent play affordance while the reel is
              active but hasn't been manually started yet. */}
          {isActive && isFocused && !playError && !autoplayPref && !manualStart && (
            <View pointerEvents="none" style={S.tapToPlay}>
              <View style={S.tapToPlayBtn}>
                <Ionicons name="play" size={40} color="#fff" />
              </View>
              <Text style={S.tapToPlayText}>Tap to play</Text>
            </View>
          )}

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
        // Hide-count is enforced client-side: owner still sees the number,
        // everyone else sees "Liked by others" / "Shared" instead. Backend
        // additionally strips the numeric fields from the payload so a
        // hostile client can't sniff them.
        isOwner={isOwner}
        hideLikeCount={ownerFlags.hideLikeCount}
        hideShareCount={ownerFlags.hideShareCount}
        onLike={handleLike}
        onComment={onOpenComments}
        onShare={handleShare}
        onSave={handleSave}
        onRepost={handleRepost}
        onMore={() => setShowMore(true)}
        // External/stock videos have no TrueVision profile to open.
        onAvatarPress={() => {
          if (!isExternal && ownerId) navigation.navigate('UserProfile', { userId: String(ownerId) });
        }}
        style={{ bottom: bottomOffset + 100 }}
      />

      {/* ── Bottom info ───────────────────────────────────────────────── */}
      <CaptionSection
        username={creator}
        caption={caption}
        song={song}
        // Three-state chip: hidden for own uploads / already-following,
        // muted "Requested" while a private-account request is pending,
        // "Follow" otherwise. isFollowing kept for backward compat.
        isFollowing={isOwner || followStatus !== 'none'}
        followStatus={isOwner ? 'following' : followStatus}
        isVerified={isVerified}
        onFollow={handleFollow}
        style={{ bottom: bottomOffset + 14 }}
      />

      {/* ── Top-right info button (ⓘ) ──────────────────────────────────── */}
      <View style={S.infoBtnWrap} pointerEvents="box-none">
        <InfoButton onPress={() => setShowInfo(true)} />
      </View>

      {/* ── Three-dot menu sheet — branches on ownership ─────────────── */}
      {isOwner ? (
        <ManageReelSheet
          visible={showMore}
          video={sheetVideo}
          onClose={() => setShowMore(false)}
          onEdit={handleOwnerEdit}
          onToggleComments={handleOwnerToggleComments}
          onToggleDownload={handleOwnerToggleDownload}
          onTogglePin={handleOwnerTogglePin}
          onToggleHideLikeCount={handleOwnerToggleHideLikeC}
          onToggleHideShareCount={handleOwnerToggleHideShareC}
          onDownload={handleOwnerDownload}
          onToggleArchive={handleOwnerArchive}
          onDelete={handleOwnerDelete}
        />
      ) : (
        <MoreSheet
          visible={showMore}
          item={item}
          onClose={() => setShowMore(false)}
          onHide={(it, reason) => onHide?.(it, reason)}
        />
      )}

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
  tapToPlay:    { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  tapToPlayBtn: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 50, padding: 20, marginBottom: 10 },
  tapToPlayText:{ color: '#fff', fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
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
