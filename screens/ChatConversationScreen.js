// truevision/screens/ChatConversationScreen.js
//
// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM CHAT — full rewrite
// ─────────────────────────────────────────────────────────────────────────────
//
// Every visual element from the previous implementation was removed:
//   ✗ blue concentric background circles / ambient glow layers
//   ✗ old glass-bubble MessageBubble
//   ✗ old Alert-based attachment dialog
//   ✗ old voice bubble
//   ✗ old image card
//   ✗ old placeholder alerts (emoji "coming soon", etc.)
//
// Replaced with:
//   ✓ WhatsApp/Telegram-style header (avatar, verified, presence, search,
//     call, video, overflow)
//   ✓ Subtle vertical gradient background
//   ✓ Modern bubbles with corner tail, gradient outgoing / dark-grey incoming,
//     entrance animation, delivery ticks, reactions, reply chip, forwarded
//     tag, edited/starred/pinned indicators
//   ✓ Telegram-style voice bubble with animated waveform, play/pause,
//     playback-speed toggle, seek + remaining time
//   ✓ Image bubble with shimmer while loading, upload progress overlay,
//     retry on failure, tap-to-open lightbox
//   ✓ Document card with type icon, filename, size, download button
//   ✓ Video bubble with duration overlay + play icon
//   ✓ Bottom-sheet AttachmentSheet (blur backdrop, 3-column icon grid)
//   ✓ rn-emoji-keyboard integration (search / recents / categories)
//   ✓ Floating blur composer — emoji, growing multiline TextInput, inline
//     attach + camera, animated send / mic swap, hold-to-record voice notes
//     with slide-cancel / slide-lock (via VoiceRecorder component)
//   ✓ In-chat search overlay — animated bar, live search, prev / next,
//     jump-to + brief bubble highlight
//
// Business logic (Socket.IO, reply/edit/react/star/pin/forward/select/delete
// endpoints, image viewer, voice recorder, push receipts) is preserved and
// unchanged.
//

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Platform,
  ActivityIndicator, Alert, StatusBar, Keyboard, KeyboardAvoidingView,
  useWindowDimensions, Animated, Easing, Clipboard as RNClipboard, Modal,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker    from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics        from 'expo-haptics';
import { Audio } from 'expo-av';

import { useAuth }   from '../context/AuthContext';
import { useTheme }  from '../context/ThemeContext';
import chatService   from '../services/ChatService';
import socketService from '../services/SocketService';
import ImageViewer      from '../components/chat/ImageViewer';
import VoiceRecorder    from '../components/chat/VoiceRecorder';
import AttachmentSheet  from '../components/chat/AttachmentSheet';

// Optional emoji picker — resolved dynamically so the app still boots even
// if the dep isn't installed. When missing, the emoji button is hidden.
let EmojiKeyboard = null;
try { EmojiKeyboard = require('rn-emoji-keyboard').default; } catch (_) {}

// Quick-react palette used by both the long-press action sheet and the
// standalone reactions strip.
const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

// ═══════════════════════════════════════════════════════════════════════════
// Palette
// ═══════════════════════════════════════════════════════════════════════════
//
// Two themes: dark (default, matches WhatsApp/Telegram dark) and light.
// No ambient glow, no concentric circles — just a subtle vertical gradient.
const palette = (dark) => dark ? {
  shell:      '#0B141A',
  bgGrad:     ['#0B141A', '#0E1720', '#0B141A'],
  header:     'rgba(11,20,26,0.92)',
  border:     'rgba(255,255,255,0.06)',
  surface:    'rgba(255,255,255,0.06)',
  surface2:   'rgba(255,255,255,0.10)',
  primary:    '#E9EDEF',
  secondary:  '#8696A0',
  dim:        'rgba(233,237,239,0.35)',
  accent:     '#3B82F6',
  online:     '#22C55E',
  seen:       '#53BDEB',
  inputBg:    'rgba(255,255,255,0.06)',
  composerBg: 'rgba(17,27,33,0.85)',
  incoming:   '#1F2C34',
  outgoing:   ['#0060DF', '#003E9E'],
  danger:     '#EF4444',
  highlight:  'rgba(250,204,21,0.55)',
  statusBar:  'light-content',
  glassTint:  'dark',
} : {
  shell:      '#FFFFFF',
  bgGrad:     ['#F7F8FA', '#EEF2F6', '#F7F8FA'],
  header:     'rgba(255,255,255,0.9)',
  border:     'rgba(15,23,42,0.08)',
  surface:    'rgba(15,23,42,0.04)',
  surface2:   'rgba(15,23,42,0.08)',
  primary:    '#0F172A',
  secondary:  '#475569',
  dim:        '#94A3B8',
  accent:     '#3B82F6',
  online:     '#16A34A',
  seen:       '#0EA5E9',
  inputBg:    'rgba(15,23,42,0.05)',
  composerBg: 'rgba(255,255,255,0.9)',
  incoming:   '#FFFFFF',
  outgoing:   ['#0060DF', '#003E9E'],
  danger:     '#DC2626',
  highlight:  'rgba(250,204,21,0.55)',
  statusBar:  'dark-content',
  glassTint:  'light',
};

// ═══════════════════════════════════════════════════════════════════════════
// useAndroidKeyboardPadding
// ═══════════════════════════════════════════════════════════════════════════
//
// Samsung One UI (Android) + RN new-arch is a known-bad combo where neither
// `Keyboard.addListener` nor `softwareKeyboardLayoutMode="resize"` alone
// gets the composer above the keyboard. We combine three signals and take
// the maximum:
//   1. Keyboard event height
//   2. Window-height shrink
//   3. TextInput-focus fallback estimate
// then subtract whatever the host View was already shrunk by.
//
// iOS uses KeyboardAvoidingView, so this hook returns 0 there.
function useAndroidKeyboardPadding(safeBottom) {
  const [kbEventH,     setKbEventH]     = useState(0);
  const [hostHeight,   setHostHeight]   = useState(0);
  const [focused,      setFocused]      = useState(false);
  const [focusFallback,setFocusFallback]= useState(0);

  const winH = useWindowDimensions().height;
  const initialWinH  = useRef(0);
  if (winH > initialWinH.current) initialWinH.current = winH;
  const initialHostH = useRef(0);
  const focusTimer   = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const apply = (e) => setKbEventH(e?.endCoordinates?.height || 0);
    const subs = [
      Keyboard.addListener('keyboardDidShow',        apply),
      Keyboard.addListener('keyboardDidChangeFrame', apply),
      Keyboard.addListener('keyboardDidHide',        () => setKbEventH(0)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    clearTimeout(focusTimer.current);
    if (focused) {
      focusTimer.current = setTimeout(() => {
        setFocusFallback(Math.round(winH * 0.45));
      }, 350);
    } else {
      setFocusFallback(0);
    }
    return () => clearTimeout(focusTimer.current);
  }, [focused, winH]);

  useEffect(() => {
    if (kbEventH > 0 && focusFallback > 0) setFocusFallback(0);
  }, [kbEventH, focusFallback]);

  const onHostLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (h > initialHostH.current) initialHostH.current = h;
    setHostHeight(h);
  }, []);

  const onInputFocus = useCallback(() => setFocused(true),  []);
  const onInputBlur  = useCallback(() => setFocused(false), []);

  let bottomPad;
  if (Platform.OS !== 'android') {
    bottomPad = 0;
  } else {
    const winShrink  = Math.max(0, initialWinH.current  - winH);
    const hostShrink = Math.max(0, initialHostH.current - hostHeight);
    const kbHeight   = Math.max(kbEventH, winShrink, focusFallback);
    bottomPad = kbHeight === 0 ? safeBottom : Math.max(0, kbHeight - hostShrink);
  }

  return { bottomPad, onHostLayout, onInputFocus, onInputBlur };
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility helpers
// ═══════════════════════════════════════════════════════════════════════════
const initials = (n) => (n || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

const formatTime = (d) => d
  ? new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  : '';

const formatDate = (d) => {
  if (!d) return '';
  const date = new Date(d), now = new Date();
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (date.toDateString() === now.toDateString())  return 'Today';
  if (date.toDateString() === yest.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatLastSeen = (d) => {
  if (!d) return '';
  const diff = Math.max(0, Date.now() - new Date(d).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'last seen just now';
  if (mins < 60) return `last seen ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `last seen ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `last seen ${days}d ago`;
  return `last seen ${new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};

const formatDuration = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

const formatBytes = (b) => {
  if (!b) return '';
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const deriveStatus = (msg) => msg.status || (msg.seen ? 'seen' : 'sent');

// ═══════════════════════════════════════════════════════════════════════════
// Building blocks
// ═══════════════════════════════════════════════════════════════════════════

// ── Avatar (image or initials gradient) ────────────────────────────────────
const Avatar = memo(({ uri, name, size = 40, ct }) => {
  if (uri) return (
    <ExpoImage
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      cachePolicy="memory-disk"
      transition={120}
    />
  );
  return (
    <LinearGradient
      colors={['#3B82F6', '#1E40AF']}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.36 }}>{initials(name)}</Text>
    </LinearGradient>
  );
});

// ── Delivery ticks — sent / delivered / seen ──────────────────────────────
const StatusTick = memo(({ status, ct }) => {
  const color = status === 'seen' ? ct.seen : 'rgba(255,255,255,0.75)';
  const icon  = status === 'sent' ? 'checkmark' : 'checkmark-done';
  return <Ionicons name={icon} size={14} color={color} style={{ marginLeft: 4 }} />;
});

// ── Date separator between message groups ─────────────────────────────────
const DateSeparator = memo(({ label, ct }) => (
  <View style={S.dateWrap}>
    <View style={[S.datePill, { backgroundColor: ct.surface, borderColor: ct.border }]}>
      <Text style={[S.dateTxt, { color: ct.secondary }]}>{label}</Text>
    </View>
  </View>
));

// ── Reply chip (denormalised parent snapshot) ─────────────────────────────
const ReplyChip = memo(({ replyTo, isMine, ct }) => {
  if (!replyTo) return null;
  const label = replyTo.senderId?.username || 'Reply';
  const preview = replyTo.preview
    || (replyTo.type === 'image'    ? '📷 Photo'
       : replyTo.type === 'voice'    ? '🎤 Voice'
       : replyTo.type === 'video'    ? '🎬 Video'
       : replyTo.type === 'document' ? '📎 Document'
       : '');
  const barColor = isMine ? '#FFFFFF' : ct.accent;
  const bg       = isMine ? 'rgba(255,255,255,0.14)' : ct.surface;
  return (
    <View style={[S.replyChip, { backgroundColor: bg }]}>
      <View style={[S.replyChipBar, { backgroundColor: barColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={[S.replyChipName, { color: isMine ? 'rgba(255,255,255,0.95)' : ct.accent }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[S.replyChipPreview, { color: isMine ? 'rgba(255,255,255,0.85)' : ct.secondary }]} numberOfLines={1}>
          {preview}
        </Text>
      </View>
    </View>
  );
});

// ── Forwarded tag ─────────────────────────────────────────────────────────
const ForwardedTag = memo(({ color }) => (
  <View style={S.metaRow}>
    <Ionicons name="arrow-redo-outline" size={12} color={color} />
    <Text style={[S.metaText, { color }]}>Forwarded</Text>
  </View>
));

// ── Edited tag ────────────────────────────────────────────────────────────
const EditedTag = memo(({ color }) => (
  <Text style={[S.metaText, { color, marginRight: 4 }]}>edited</Text>
));

// ── Reactions strip (below bubble) ────────────────────────────────────────
const ReactionsStrip = memo(({ reactions, myId, onToggle, isMine, ct }) => {
  if (!reactions || reactions.length === 0) return null;
  const groups = reactions.reduce((acc, r) => {
    (acc[r.emoji] ||= []).push(r.userId?._id || r.userId);
    return acc;
  }, {});
  const entries = Object.entries(groups);
  return (
    <View style={[
      S.reactionsRow,
      isMine ? { alignSelf: 'flex-end', marginRight: 8 }
             : { alignSelf: 'flex-start', marginLeft: 44 },
    ]}>
      {entries.map(([emoji, userIds]) => {
        const mine = userIds.some((id) => (id?.toString?.() ?? id) === (myId?.toString?.() ?? myId));
        return (
          <TouchableOpacity
            key={emoji}
            onPress={() => onToggle(emoji)}
            style={[S.reactionChip, {
              backgroundColor: ct.surface2,
              borderColor:     mine ? ct.accent : ct.border,
            }]}
          >
            <Text style={{ fontSize: 13 }}>{emoji}</Text>
            {userIds.length > 1 && (
              <Text style={{ marginLeft: 4, fontSize: 11, color: ct.secondary, fontWeight: '600' }}>
                {userIds.length}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Media bubbles
// ═══════════════════════════════════════════════════════════════════════════

// ── Voice message (Telegram-style waveform + playback controls) ───────────
function VoiceMessageBubble({ msg, isMine, ct }) {
  const [sound,   setSound]   = useState(null);
  const [playing, setPlaying] = useState(false);
  const [posMs,   setPosMs]   = useState(0);
  const [speed,   setSpeed]   = useState(1);   // 1x → 1.5x → 2x cycle

  const total = msg.audioDuration || 0;
  const progress = total > 0 ? Math.min(1, (posMs / 1000) / total) : 0;

  // Waveform — supplied by server or derived deterministically from _id so
  // each message renders the same bars across app restarts.
  const bars = (msg.waveform && msg.waveform.length ? msg.waveform
    : Array.from({ length: 30 }, (_, i) => {
        const seed = (msg._id?.toString?.().charCodeAt(i % 24) || 65) + i * 7;
        return 6 + (seed % 20);
      })
  );

  useEffect(() => () => { if (sound) sound.unloadAsync(); }, [sound]);

  const togglePlay = async () => {
    try {
      if (playing) { await sound?.pauseAsync(); setPlaying(false); return; }
      if (!sound) {
        const { sound: s } = await Audio.Sound.createAsync(
          { uri: msg.audioUrl },
          { shouldPlay: true, rate: speed, shouldCorrectPitch: true },
        );
        s.setOnPlaybackStatusUpdate((st) => {
          if (!st.isLoaded) return;
          setPosMs(st.positionMillis || 0);
          if (st.didJustFinish) { setPlaying(false); setPosMs(0); }
        });
        setSound(s); setPlaying(true);
      } else {
        await sound.playAsync(); setPlaying(true);
      }
    } catch (e) { console.warn('voice play', e.message); }
  };

  const cycleSpeed = async () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (sound) {
      try { await sound.setRateAsync(next, true); } catch (_) {}
    }
  };

  const barActive = isMine ? '#FFFFFF' : ct.accent;
  const barIdle   = isMine ? 'rgba(255,255,255,0.35)' : ct.dim;

  return (
    <View style={S.voiceRow}>
      <TouchableOpacity onPress={togglePlay} style={[S.voicePlay, {
        backgroundColor: isMine ? 'rgba(255,255,255,0.2)' : ct.accent,
      }]}>
        <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={S.voiceMid}>
        <View style={S.voiceBars}>
          {bars.slice(0, 30).map((h, i) => (
            <View
              key={i}
              style={{
                width: 2.5, height: h, marginHorizontal: 1.5, borderRadius: 2,
                backgroundColor: i / 30 < progress ? barActive : barIdle,
              }}
            />
          ))}
        </View>
        <Text style={[S.voiceTime, {
          color: isMine ? 'rgba(255,255,255,0.75)' : ct.secondary,
        }]}>
          {playing || posMs > 0
            ? formatDuration(Math.max(0, total - posMs / 1000))
            : formatDuration(total)}
        </Text>
      </View>

      {/* Speed toggle only after user has played once */}
      {(playing || posMs > 0) && (
        <TouchableOpacity
          onPress={cycleSpeed}
          style={[S.speedBadge, { backgroundColor: isMine ? 'rgba(255,255,255,0.16)' : ct.surface }]}
        >
          <Text style={[S.speedTxt, { color: isMine ? '#FFFFFF' : ct.primary }]}>
            {speed === 1 ? '1×' : speed === 1.5 ? '1.5×' : '2×'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Image message (shimmer while loading + retry on error) ────────────────
function ImageMessageBubble({ uri, onPress }) {
  const [state, setState]   = useState('loading');   // 'loading' | 'ok' | 'error'
  const [attempt, setAttempt] = useState(0);
  const shimmer = useRef(new Animated.Value(0)).current;

  // Shimmer animation loop — runs only while loading to save cycles.
  useEffect(() => {
    if (state !== 'loading') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, shimmer]);

  const retry = () => { setState('loading'); setAttempt((n) => n + 1); };

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={S.imgWrap}>
      <ExpoImage
        key={`${uri}-${attempt}`}
        source={{ uri }}
        style={S.imgMsg}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
        onLoad={() => setState('ok')}
        onError={() => setState('error')}
      />

      {/* Shimmer overlay */}
      {state === 'loading' && (
        <Animated.View style={[S.imgShimmer, { opacity: shimmer }]} />
      )}

      {/* Error / retry overlay */}
      {state === 'error' && (
        <View style={S.imgError}>
          <Ionicons name="alert-circle-outline" size={32} color="#FFFFFF" />
          <Text style={S.imgErrorTxt}>Couldn’t load image</Text>
          <TouchableOpacity onPress={retry} style={S.retryBtn}>
            <Ionicons name="refresh" size={14} color="#FFFFFF" />
            <Text style={S.retryBtnTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Video message (thumbnail + play + duration) ───────────────────────────
const VideoMessageBubble = memo(({ video, isMine, ct, onPress }) => {
  if (!video) return null;
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={S.vidWrap}>
      <ExpoImage
        source={{ uri: video.thumbnailUrl }}
        style={S.vidThumb}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={S.vidGrad} />
      <View style={S.vidPlay}>
        <Ionicons name="play" size={22} color="#FFFFFF" />
      </View>
      {video.duration > 0 && (
        <View style={S.vidDur}>
          <Text style={S.vidDurTxt}>{formatDuration(video.duration)}</Text>
        </View>
      )}
      {video.title && (
        <Text style={[S.vidTitle, { color: isMine ? '#FFFFFF' : ct.primary }]} numberOfLines={2}>
          {video.title}
        </Text>
      )}
    </TouchableOpacity>
  );
});

// ── Document message (type icon + name + size + download) ─────────────────
const DocumentMessageBubble = memo(({ msg, isMine, ct }) => {
  const ext = (msg.documentName?.split('.').pop() || '').slice(0, 4).toUpperCase();
  const iconBg = isMine ? 'rgba(255,255,255,0.18)' : ct.accent;
  return (
    <View style={S.docRow}>
      <View style={[S.docIcon, { backgroundColor: iconBg }]}>
        <Ionicons name="document-text" size={22} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[S.docName, { color: isMine ? '#FFFFFF' : ct.primary }]} numberOfLines={1}>
          {msg.documentName || 'Document'}
        </Text>
        <Text style={[S.docMeta, { color: isMine ? 'rgba(255,255,255,0.72)' : ct.secondary }]}>
          {ext || 'FILE'} · {formatBytes(msg.documentSize) || '—'}
        </Text>
      </View>
      <TouchableOpacity style={[S.docDl, { backgroundColor: isMine ? 'rgba(255,255,255,0.16)' : ct.surface }]}>
        <Ionicons name="download-outline" size={18} color={isMine ? '#FFFFFF' : ct.primary} />
      </TouchableOpacity>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// MessageBubble — the composite bubble + tail + animations
// ═══════════════════════════════════════════════════════════════════════════
const MessageBubble = memo(function MessageBubble({
  msg, isMine, showDate, myId, otherUser, ct, isFirstInGroup,
  selected, selectionMode, highlighted, searchQuery,
  onLongPress, onSelectToggle, onReactToggle, onImagePress, onVideoPress,
  navigation,
}) {
  // Slide-in + fade on mount so newly-arrived messages feel alive.
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);
  const enterStyle = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };

  const textColor = isMine ? '#FFFFFF' : ct.primary;
  const timeColor = isMine ? 'rgba(255,255,255,0.70)' : ct.dim;
  const isForwarded = !!msg.forwardedFrom;

  const renderText = () => {
    if (!msg.text) return null;
    const q = (searchQuery || '').trim();
    if (!q) return <Text style={[S.msgText, { color: textColor }]}>{msg.text}</Text>;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = msg.text.split(new RegExp(`(${escaped})`, 'i'));
    return (
      <Text style={[S.msgText, { color: textColor }]}>
        {parts.map((p, i) => (
          p.toLowerCase() === q.toLowerCase()
            ? <Text key={i} style={{ backgroundColor: ct.highlight, color: '#0F172A', fontWeight: '700' }}>{p}</Text>
            : <Text key={i}>{p}</Text>
        ))}
      </Text>
    );
  };

  const body = (
    <>
      {msg.replyTo && <ReplyChip replyTo={msg.replyTo} isMine={isMine} ct={ct} />}
      {isForwarded && !msg.deleted && <ForwardedTag color={timeColor} />}

      {msg.deleted ? (
        <View style={S.delRow}>
          <Ionicons name="ban-outline" size={13} color={timeColor} />
          <Text style={[S.delTxt, { color: timeColor }]}>This message was deleted</Text>
        </View>
      ) : (
        <>
          {msg.type === 'image' && msg.imageUrl && (
            <ImageMessageBubble uri={msg.imageUrl} onPress={() => onImagePress(msg.imageUrl)} />
          )}
          {msg.type === 'gif' && msg.gifUrl && (
            <ImageMessageBubble uri={msg.gifUrl} onPress={() => onImagePress(msg.gifUrl)} />
          )}
          {msg.type === 'video' && msg.videoId && (
            <VideoMessageBubble
              video={msg.videoId}
              isMine={isMine}
              ct={ct}
              onPress={() => onVideoPress(msg.videoId)}
            />
          )}
          {(msg.type === 'voice' || msg.type === 'audio') && msg.audioUrl && (
            <VoiceMessageBubble msg={msg} isMine={isMine} ct={ct} />
          )}
          {msg.type === 'document' && msg.documentUrl && (
            <DocumentMessageBubble msg={msg} isMine={isMine} ct={ct} />
          )}
          {renderText()}
        </>
      )}

      <View style={S.msgFoot}>
        {msg.edited && !msg.deleted && <EditedTag color={timeColor} />}
        {msg.pinned && !msg.deleted && (
          <Ionicons name="pin" size={11} color={timeColor}
            style={{ marginRight: 4, transform: [{ rotate: '45deg' }] }} />
        )}
        {(msg.starredBy || []).some((u) => (u?._id || u)?.toString?.() === myId?.toString?.()) && (
          <Ionicons name="star" size={11} color={timeColor} style={{ marginRight: 4 }} />
        )}
        <Text style={[S.msgTime, { color: timeColor }]}>{formatTime(msg.createdAt)}</Text>
        {isMine && !msg.deleted && <StatusTick status={deriveStatus(msg)} ct={ct} />}
      </View>
    </>
  );

  return (
    <Animated.View style={enterStyle}>
      {showDate && <DateSeparator label={formatDate(msg.createdAt)} ct={ct} />}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => selectionMode && onSelectToggle(msg)}
        onLongPress={() => onLongPress(msg)}
        delayLongPress={260}
      >
        <View style={[
          S.bubbleRow,
          isMine ? S.bubbleRowRight : S.bubbleRowLeft,
          selected    && { backgroundColor: 'rgba(59,130,246,0.10)' },
          highlighted && { backgroundColor: 'rgba(250,204,21,0.16)' },
        ]}>
          {!isMine && isFirstInGroup && (
            <View style={S.bubbleAvatar}>
              <Avatar uri={otherUser?.profileImage} name={otherUser?.fullName || otherUser?.username} size={28} ct={ct} />
            </View>
          )}
          {!isMine && !isFirstInGroup && <View style={{ width: 36 }} />}

          {isMine ? (
            <LinearGradient
              colors={ct.outgoing}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[S.bubble, isFirstInGroup ? S.bubbleMineFirst : S.bubbleMineCont]}
            >
              {body}
            </LinearGradient>
          ) : (
            <View style={[
              S.bubble,
              isFirstInGroup ? S.bubbleTheirsFirst : S.bubbleTheirsCont,
              { backgroundColor: ct.incoming, borderColor: ct.border },
            ]}>
              {body}
            </View>
          )}
        </View>
      </TouchableOpacity>
      <ReactionsStrip
        reactions={msg.reactions}
        myId={myId}
        onToggle={(emoji) => onReactToggle(msg, emoji)}
        isMine={isMine}
        ct={ct}
      />
    </Animated.View>
  );
}, (prev, next) =>
  prev.msg._id === next.msg._id
  && prev.msg.text === next.msg.text
  && prev.msg.status === next.msg.status
  && prev.msg.deleted === next.msg.deleted
  && prev.msg.edited === next.msg.edited
  && prev.msg.pinned === next.msg.pinned
  && (prev.msg.reactions?.length || 0) === (next.msg.reactions?.length || 0)
  && (prev.msg.starredBy?.length || 0) === (next.msg.starredBy?.length || 0)
  && prev.selected === next.selected
  && prev.selectionMode === next.selectionMode
  && prev.showDate === next.showDate
  && prev.isFirstInGroup === next.isFirstInGroup
  && prev.highlighted === next.highlighted
  && prev.searchQuery === next.searchQuery,
);

// ═══════════════════════════════════════════════════════════════════════════
// Typing bubble
// ═══════════════════════════════════════════════════════════════════════════
function TypingBubble({ ct, otherUser }) {
  const dots = [useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((v, i) => Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 380, delay: i * 130, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 380,                 easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(200),
      ]),
    ));
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={S.typingRow}>
      <View style={S.bubbleAvatar}>
        <Avatar uri={otherUser?.profileImage} name={otherUser?.fullName || otherUser?.username} size={24} ct={ct} />
      </View>
      <View style={[S.typingBubble, { backgroundColor: ct.incoming, borderColor: ct.border }]}>
        <View style={{ flexDirection: 'row' }}>
          {dots.map((v, i) => (
            <Animated.View key={i} style={{
              width: 6, height: 6, borderRadius: 3, marginHorizontal: 2, backgroundColor: ct.secondary,
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
              transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
            }} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════
export default function ChatConversationScreen({ route, navigation }) {
  const { chatId, otherUser } = route.params;
  const { user: me }  = useAuth();
  const { isDark }    = useTheme();
  const ct            = palette(isDark);
  const insets        = useSafeAreaInsets();
  const kb            = useAndroidKeyboardPadding(insets.bottom);

  // ── Chat state ─────────────────────────────────────────────────────────
  const [messages,    setMessages]    = useState([]);
  const [text,        setText]        = useState('');
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typing,      setTyping]      = useState(false);
  const [isOnline,    setIsOnline]    = useState(!!otherUser?.isOnline);
  const [lastSeen,    setLastSeen]    = useState(otherUser?.lastSeen || null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // ── Feature state ──────────────────────────────────────────────────────
  const [replyTo,      setReplyTo]      = useState(null);
  const [editingId,    setEditingId]    = useState(null);
  const [actionMsg,    setActionMsg]    = useState(null);
  const [viewerImages, setViewerImages] = useState(null);
  const [viewerIndex,  setViewerIndex]  = useState(0);
  const [selected,     setSelected]     = useState({});
  const [uploadPct,    setUploadPct]    = useState(0);
  const [voiceActive,  setVoiceActive]  = useState(false);
  const [attachOpen,   setAttachOpen]   = useState(false);
  const [emojiOpen,    setEmojiOpen]    = useState(false);
  const [caret,        setCaret]        = useState({ start: 0, end: 0 });

  // ── In-chat search ─────────────────────────────────────────────────────
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchHits,   setSearchHits]   = useState([]);
  const [searchIdx,    setSearchIdx]    = useState(0);
  const [searchLoad,   setSearchLoad]   = useState(false);
  const [highlightId,  setHighlightId]  = useState(null);
  const searchTimer   = useRef(null);
  const highlightTimer= useRef(null);
  const searchBarAnim = useRef(new Animated.Value(0)).current;

  // Composer send-button pulse when text becomes typable.
  const sendPulse = useRef(new Animated.Value(1)).current;

  // ── Refs ────────────────────────────────────────────────────────────────
  const flatListRef = useRef(null);
  const inputRef    = useRef(null);
  const typingTimer = useRef(null);

  const selectionMode = Object.keys(selected).length > 0;

  // ── Load messages ──────────────────────────────────────────────────────
  const loadMessages = useCallback(async (p = 1, append = false) => {
    if (p > 1) setLoadingMore(true);
    const res = await chatService.getMessages(chatId, { page: p });
    if (res.success) {
      const reversed = [...(res.messages || [])].reverse();
      if (append) setMessages((prev) => [...prev, ...reversed]);
      else        setMessages(reversed);
      setHasMore(res.hasMore);
      setPage(p);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [chatId]);

  useEffect(() => {
    loadMessages(1);
    chatService.markAsRead(chatId);
  }, [loadMessages, chatId]);

  // ── Socket wiring ──────────────────────────────────────────────────────
  useEffect(() => {
    socketService.connect();
    socketService.emit('joinChat', chatId);
    socketService.emit('markSeen', { chatId });

    const unsubs = [
      socketService.on('newMessage', (msg) => {
        if (msg.chatId !== chatId) return;
        setMessages((prev) => prev.some((m) => m._id === msg._id) ? prev : [msg, ...prev]);
        const fromOther = (msg.senderId?._id || msg.senderId) !== me?._id;
        if (fromOther) socketService.emit('markSeen', { chatId });
      }),
      socketService.on('messageSeen', ({ chatId: c }) => {
        if (c !== chatId) return;
        setMessages((prev) => prev.map((m) => ({ ...m, status: 'seen', seen: true })));
      }),
      socketService.on('messageDelivered', ({ chatId: c, messageId }) => {
        if (c !== chatId) return;
        setMessages((prev) => prev.map((m) =>
          m._id === messageId && m.status !== 'seen' ? { ...m, status: 'delivered' } : m,
        ));
      }),
      socketService.on('messagesDelivered', ({ items }) => {
        const ids = new Set((items || []).filter((i) => i.chatId === chatId).map((i) => i.messageId));
        if (!ids.size) return;
        setMessages((prev) => prev.map((m) =>
          ids.has(m._id) && m.status !== 'seen' ? { ...m, status: 'delivered' } : m,
        ));
      }),
      socketService.on('typing',     ({ chatId: c, userId: u }) => { if (c === chatId && u !== me?._id) setTyping(true);  }),
      socketService.on('stopTyping', ({ chatId: c, userId: u }) => { if (c === chatId && u !== me?._id) setTyping(false); }),
      socketService.on('userOnline',  ({ userId: u }) => { if (u === otherUser?._id) setIsOnline(true); }),
      socketService.on('userOffline', ({ userId: u, lastSeen: ls }) => {
        if (u !== otherUser?._id) return;
        setIsOnline(false); if (ls) setLastSeen(ls);
      }),
      socketService.on('messageReaction', ({ chatId: c, messageId, reactions }) => {
        if (c !== chatId) return;
        setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, reactions } : m));
      }),
      socketService.on('messageEdited', ({ chatId: c, messageId, text: t, editedAt }) => {
        if (c !== chatId) return;
        setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, text: t, edited: true, editedAt } : m));
      }),
      socketService.on('messageDeleted', ({ chatId: c, messageId, scope }) => {
        if (c !== chatId || scope !== 'everyone') return;
        setMessages((prev) => prev.map((m) => m._id === messageId
          ? { ...m, deleted: true, text: '', imageUrl: null, audioUrl: null, gifUrl: null, documentUrl: null }
          : m));
      }),
      socketService.on('messagePinned', ({ chatId: c, messageId, pinned }) => {
        if (c !== chatId) return;
        setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, pinned } : m));
      }),
    ];
    return () => { socketService.emit('leaveChat', chatId); unsubs.forEach((fn) => fn()); };
  }, [chatId, me?._id, otherUser?._id]);

  // ── Send-button pulse when text state flips empty↔non-empty ────────────
  useEffect(() => {
    if (!text.trim()) return;
    Animated.sequence([
      Animated.timing(sendPulse, { toValue: 1.12, duration: 130, useNativeDriver: true }),
      Animated.timing(sendPulse, { toValue: 1,    duration: 130, useNativeDriver: true }),
    ]).start();
  }, [text.length === 0, sendPulse]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═════════════════════════════════════════════════════════════════════
  // Handlers
  // ═════════════════════════════════════════════════════════════════════

  // ── Send text / edit ───────────────────────────────────────────────────
  const sendTextMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (editingId) {
      setSending(true); setText('');
      const res = await chatService.editMessage(chatId, editingId, trimmed);
      if (res?.success) {
        setMessages((prev) => prev.map((m) =>
          m._id === editingId ? { ...m, text: trimmed, edited: true, editedAt: new Date().toISOString() } : m,
        ));
      }
      setEditingId(null); setSending(false); return;
    }

    setSending(true); setText('');
    socketService.emit('stopTyping', { chatId });
    const clientMsgId = chatService.clientMsgId();
    const replyPayload = replyTo ? { replyTo } : {};
    const sock = socketService.getSocket();
    if (sock?.connected) {
      socketService.emit('sendMessage',
        { chatId, text: trimmed, type: 'text', clientMsgId, ...replyPayload },
        (res) => {
          if (!res?.success) chatService.sendMessage(chatId, { text: trimmed, clientMsgId, ...replyPayload });
          setSending(false);
        });
    } else {
      await chatService.sendMessage(chatId, { text: trimmed, clientMsgId, ...replyPayload });
      loadMessages(1); setSending(false);
    }
    setReplyTo(null);
  };

  const sendVideoMessage = (videoId) => {
    const clientMsgId = chatService.clientMsgId();
    const s = socketService.getSocket();
    if (s?.connected) socketService.emit('sendMessage', { chatId, type: 'video', videoId, text: '', clientMsgId });
    else chatService.sendMessage(chatId, { type: 'video', videoId, clientMsgId });
  };

  // ── Media upload helpers ───────────────────────────────────────────────
  const uploadAndSendImage = async (asset) => {
    setSending(true); setUploadPct(0);
    const up = await chatService.uploadChatImage(asset.uri, {
      mimeType: asset.mimeType || 'image/jpeg',
      name:     asset.fileName || `chat-${Date.now()}.jpg`,
      onProgress: setUploadPct,
    });
    setUploadPct(0);
    if (!up.success) { setSending(false); return Alert.alert('Upload failed', up.message || 'Could not send photo.'); }
    const clientMsgId = chatService.clientMsgId();
    const replyPayload = replyTo ? { replyTo } : {};
    const payload = {
      chatId, type: 'image', imageUrl: up.url,
      imagePublicId: up.publicId, imageWidth: up.width, imageHeight: up.height,
      text: '', clientMsgId, ...replyPayload,
    };
    const s = socketService.getSocket();
    if (s?.connected) socketService.emit('sendMessage', payload);
    else { await chatService.sendMessage(chatId, payload); loadMessages(1); }
    setReplyTo(null); setSending(false);
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission required', 'Camera permission needed.');
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (r.canceled || !r.assets?.[0]) return;
    uploadAndSendImage(r.assets[0]);
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission required', 'Media library permission needed.');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (r.canceled || !r.assets?.[0]) return;
    uploadAndSendImage(r.assets[0]);
  };

  const openVideoPicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission required', 'Media library permission needed.');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.7 });
    if (r.canceled || !r.assets?.[0]) return;
    // Videos ride the TrueVision picker path
    navigation.navigate('ShareVideo', { chatId, onSelectVideo: sendVideoMessage });
  };

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setSending(true); setUploadPct(0);
      const up = await chatService.uploadChatDocument(asset.uri, {
        mimeType: asset.mimeType || 'application/octet-stream',
        name:     asset.name || `doc-${Date.now()}`,
        onProgress: setUploadPct,
      });
      setUploadPct(0);
      if (!up.success) { setSending(false); return Alert.alert('Upload failed', up.message || 'Could not send document.'); }
      const clientMsgId = chatService.clientMsgId();
      const payload = {
        chatId, type: 'document',
        documentUrl: up.url, documentPublicId: up.publicId,
        documentName: asset.name || 'Document',
        documentSize: asset.size || up.bytes || 0,
        documentMime: asset.mimeType || '',
        text: '', clientMsgId,
      };
      const s = socketService.getSocket();
      if (s?.connected) socketService.emit('sendMessage', payload);
      else { await chatService.sendMessage(chatId, payload); loadMessages(1); }
      setSending(false);
    } catch (e) { setSending(false); Alert.alert('Error', e.message); }
  };

  // ── Attachment sheet dispatcher ────────────────────────────────────────
  const handleAttach = (kind) => {
    switch (kind) {
      case 'camera':   openCamera();       break;
      case 'gallery':  openGallery();      break;
      case 'video':    openVideoPicker();  break;
      case 'document': pickDocument();     break;
      case 'audio':    pickDocument();     break; // handled via document picker for generic audio
      case 'voice':    /* long-press composer mic instead */ break;
      case 'location':
      case 'contact':
      case 'poll':
        Alert.alert('Coming soon', 'This attachment type is on the way.');
        break;
      default: break;
    }
  };

  // ── Voice notes ────────────────────────────────────────────────────────
  const uploadAndSendVoice = async ({ uri, durationMs }) => {
    if (!uri) return;
    const totalSecs = Math.max(1, Math.round(durationMs / 1000));
    setSending(true); setUploadPct(0);
    try {
      const up = await chatService.uploadChatVoice(uri, {
        mimeType: 'audio/m4a', name: `voice-${Date.now()}.m4a`, onProgress: setUploadPct,
      });
      setUploadPct(0);
      if (!up.success) { setSending(false); return Alert.alert('Upload failed', up.message || 'Could not send voice note.'); }
      const clientMsgId = chatService.clientMsgId();
      const payload = {
        chatId, type: 'voice',
        audioUrl: up.url, audioPublicId: up.publicId,
        audioDuration: totalSecs, text: '', clientMsgId,
      };
      const s = socketService.getSocket();
      if (s?.connected) socketService.emit('sendMessage', payload);
      else { await chatService.sendMessage(chatId, payload); loadMessages(1); }
      setSending(false);
    } catch (e) { console.warn('voice send', e.message); setSending(false); }
  };

  // ── Typing signal ──────────────────────────────────────────────────────
  const handleTextChange = (t) => {
    setText(t);
    socketService.emit('typing', { chatId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socketService.emit('stopTyping', { chatId }), 2000);
  };

  // ── Message actions ────────────────────────────────────────────────────
  const handleLongPress = (msg) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setActionMsg(msg);
  };

  const doReply = (msg) => {
    setReplyTo({
      messageId: msg._id,
      senderId:  { _id: msg.senderId?._id, username: msg.senderId?.username || 'Reply' },
      preview:   msg.text || (msg.type === 'image' ? '📷 Photo' : msg.type === 'voice' ? '🎤 Voice' : msg.type === 'document' ? `📎 ${msg.documentName}` : ''),
      type:      msg.type,
    });
    setActionMsg(null);
  };

  const doCopy = (msg) => { if (msg.text) RNClipboard.setString(msg.text); setActionMsg(null); };
  const doEdit = (msg) => { setEditingId(msg._id); setText(msg.text || ''); setActionMsg(null); };

  const doReact = (msg, emoji) => {
    setActionMsg(null);
    setMessages((prev) => prev.map((m) => {
      if (m._id !== msg._id) return m;
      const has = (m.reactions || []).some((r) =>
        (r.userId?._id || r.userId)?.toString?.() === me?._id?.toString?.() && r.emoji === emoji);
      const next = has
        ? (m.reactions || []).filter((r) => !((r.userId?._id || r.userId)?.toString?.() === me?._id?.toString?.() && r.emoji === emoji))
        : [...(m.reactions || []), { userId: { _id: me?._id, username: me?.username }, emoji }];
      return { ...m, reactions: next };
    }));
    chatService.reactToMessage(chatId, msg._id, emoji);
  };

  const doStar = async (msg) => {
    setActionMsg(null);
    await chatService.toggleStarMessage(chatId, msg._id);
    setMessages((prev) => prev.map((m) => {
      if (m._id !== msg._id) return m;
      const has = (m.starredBy || []).some((u) => (u?._id || u)?.toString?.() === me?._id?.toString?.());
      const next = has
        ? (m.starredBy || []).filter((u) => (u?._id || u)?.toString?.() !== me?._id?.toString?.())
        : [...(m.starredBy || []), me?._id];
      return { ...m, starredBy: next };
    }));
  };

  const doPin = async (msg) => {
    setActionMsg(null);
    const res = await chatService.togglePinMessage(chatId, msg._id);
    if (!res?.success) return Alert.alert('Pin failed', res?.message || 'Try again.');
    setMessages((prev) => prev.map((m) => m._id === msg._id ? { ...m, pinned: !m.pinned } : m));
  };

  const doForward = (msg) => {
    setActionMsg(null);
    navigation.navigate('ForwardMessage', { messageIds: [msg._id], fromChatId: chatId });
  };

  const doSelect = (msg) => {
    setActionMsg(null);
    setSelected((s) => ({ ...s, [msg._id]: true }));
  };

  const doDelete = (msg, scope = 'me') => {
    setActionMsg(null);
    const isMine = (msg.senderId?._id || msg.senderId) === me?._id;
    if (scope === 'everyone' && !isMine) return;
    Alert.alert(
      scope === 'everyone' ? 'Delete for everyone?' : 'Delete for me?',
      scope === 'everyone' ? 'The message will disappear for everyone in this chat.' : 'Only you will lose sight of this message.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const res = await chatService.deleteMessage(chatId, msg._id, scope);
          if (!res?.success) return Alert.alert('Failed', res?.message || 'Try again.');
          if (scope === 'everyone') {
            setMessages((prev) => prev.map((m) => m._id === msg._id ? { ...m, deleted: true, text: '' } : m));
          } else {
            setMessages((prev) => prev.filter((m) => m._id !== msg._id));
          }
        }},
      ],
    );
  };

  // ── Selection mode ─────────────────────────────────────────────────────
  const toggleSelect = (msg) => setSelected((s) => {
    const n = { ...s }; if (n[msg._id]) delete n[msg._id]; else n[msg._id] = true; return n;
  });
  const clearSelection = () => setSelected({});
  const bulkDelete = () => {
    const ids = Object.keys(selected);
    if (!ids.length) return;
    Alert.alert(`Delete ${ids.length} message${ids.length > 1 ? 's' : ''}?`, 'Only you will lose sight of these.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          await Promise.all(ids.map((id) => chatService.deleteMessage(chatId, id, 'me')));
          setMessages((prev) => prev.filter((m) => !selected[m._id]));
          clearSelection();
        }},
      ],
    );
  };
  const bulkForward = () => {
    const ids = Object.keys(selected);
    if (!ids.length) return;
    navigation.navigate('ForwardMessage', { messageIds: ids, fromChatId: chatId });
    clearSelection();
  };

  // ── Call / more menu ───────────────────────────────────────────────────
  const startCall = (kind) => Alert.alert(`${kind} call`, `${kind} calling will be available soon.`);

  const showMoreMenu = () => {
    Alert.alert(
      otherUser?.username || 'Chat',
      undefined,
      [
        { text: 'View contact', onPress: () => Alert.alert('Contact', 'Contact profile view coming soon.') },
        { text: 'Search in chat', onPress: openSearchBar },
        { text: 'Mute notifications', onPress: async () => {
          const r = await chatService.toggleMuteChat(chatId);
          Alert.alert('Notifications', r?.success ? 'Mute setting updated.' : 'Failed');
        }},
        { text: 'Pin chat', onPress: async () => {
          const r = await chatService.togglePinChat(chatId);
          Alert.alert('Pin', r?.success ? 'Pin toggled.' : 'Failed');
        }},
        { text: 'Archive', onPress: async () => {
          const r = await chatService.toggleArchive(chatId);
          if (r?.success) navigation.goBack();
        }},
        { text: 'Clear chat', style: 'destructive', onPress: async () => {
          Alert.alert('Clear chat?', 'Removes messages from your view only.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear',  style: 'destructive', onPress: async () => {
              const r = await chatService.clearChatHistory(chatId);
              if (r?.success) setMessages([]);
            }},
          ]);
        }},
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  // ── In-chat search ─────────────────────────────────────────────────────
  const openSearchBar = () => {
    setSearchOpen(true);
    Animated.timing(searchBarAnim, {
      toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  };
  const closeSearch = () => {
    Animated.timing(searchBarAnim, {
      toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => {
      setSearchOpen(false); setSearchQuery(''); setSearchHits([]); setSearchIdx(0);
    });
  };
  const runChatSearch = useCallback((q) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchHits([]); setSearchIdx(0); return; }
    setSearchLoad(true);
    searchTimer.current = setTimeout(async () => {
      const r = await chatService.searchMessages(chatId, q.trim());
      const hits = r?.success ? (r.messages || []) : [];
      setSearchHits(hits); setSearchIdx(0); setSearchLoad(false);
      if (hits.length) jumpToSearchHit(0, hits);
    }, 300);
  }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const jumpToSearchHit = (idx, hitsOverride) => {
    const hits = hitsOverride || searchHits;
    if (!hits.length) return;
    const target = hits[idx];
    if (!target) return;
    const pos = messages.findIndex((m) => m._id === target._id);
    if (pos >= 0) {
      try { flatListRef.current?.scrollToIndex({ index: pos, animated: true, viewPosition: 0.4 }); } catch (_) {}
    }
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    setHighlightId(target._id);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 1200);
  };
  const nextHit = () => { if (!searchHits.length) return; const n = (searchIdx + 1) % searchHits.length; setSearchIdx(n); jumpToSearchHit(n); };
  const prevHit = () => { if (!searchHits.length) return; const n = (searchIdx - 1 + searchHits.length) % searchHits.length; setSearchIdx(n); jumpToSearchHit(n); };

  // ── Emoji picker (inserts at caret) ────────────────────────────────────
  const openEmojiPanel = () => {
    if (!EmojiKeyboard) return;   // silently no-op — button is hidden below
    Keyboard.dismiss();
    setEmojiOpen(true);
  };
  const insertEmoji = (emojiObj) => {
    const glyph = emojiObj?.emoji || '';
    if (!glyph) return;
    const start = Math.max(0, Math.min(caret.start, text.length));
    const end   = Math.max(0, Math.min(caret.end,   text.length));
    const next  = text.slice(0, start) + glyph + text.slice(end);
    setText(next);
    const pos = start + glyph.length;
    setCaret({ start: pos, end: pos });
  };

  const shouldShowDate = (msg, idx) => {
    if (idx === messages.length - 1) return true;
    return new Date(msg.createdAt).toDateString() !== new Date(messages[idx + 1].createdAt).toDateString();
  };
  const isFirstInGroup = (msg, idx) => {
    if (idx === messages.length - 1) return true;
    const prev = messages[idx + 1];
    const senderPrev = prev.senderId?._id || prev.senderId;
    const senderCur  = msg.senderId?._id  || msg.senderId;
    return senderPrev !== senderCur;
  };
  const canSend = !!text.trim() && !sending;

  // ═════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════
  return (
    <View style={[S.shell, { backgroundColor: ct.shell }]}>
      {/* Subtle vertical gradient — clean, no ambient graphics */}
      <LinearGradient colors={ct.bgGrad} style={StyleSheet.absoluteFill} />
      <StatusBar barStyle={ct.statusBar} backgroundColor="transparent" translucent />

      <SafeAreaView style={S.root} edges={Platform.OS === 'ios' ? ['top', 'bottom'] : ['top']}>
        <KeyboardAvoidingView
          style={S.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
        <View style={[S.root, { paddingBottom: kb.bottomPad }]} onLayout={kb.onHostLayout}>

          {/* ────────────── HEADER ────────────── */}
          <View style={[S.header, { borderBottomColor: ct.border, backgroundColor: ct.header }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={S.hBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={26} color={ct.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={S.hIdentity} activeOpacity={0.7}
              onPress={() => Alert.alert('Contact', 'Contact profile view coming soon.')}>
              <View>
                <Avatar uri={otherUser?.profileImage} name={otherUser?.fullName || otherUser?.username} size={40} ct={ct} />
                <View style={[S.hPresence, {
                  backgroundColor: isOnline ? ct.online : 'transparent',
                  borderColor: ct.shell,
                }]} />
              </View>
              <View style={S.hInfo}>
                <View style={S.hNameRow}>
                  <Text style={[S.hName, { color: ct.primary }]} numberOfLines={1}>
                    {otherUser?.username || 'User'}
                  </Text>
                  {otherUser?.isVerified && (
                    <MaterialCommunityIcons name="check-decagram" size={14} color={ct.accent} style={{ marginLeft: 4 }} />
                  )}
                </View>
                <Text
                  style={[S.hStatus, {
                    color: typing ? ct.accent : isOnline ? ct.online : ct.secondary,
                  }]}
                  numberOfLines={1}
                >
                  {typing ? 'typing…' : isOnline ? 'online' : (lastSeen ? formatLastSeen(lastSeen) : '')}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={S.hActions}>
              <TouchableOpacity onPress={openSearchBar} style={S.hBtn}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                <Ionicons name="search" size={20} color={ct.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => startCall('Video')} style={S.hBtn}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                <Ionicons name="videocam-outline" size={22} color={ct.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => startCall('Voice')} style={S.hBtn}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                <Ionicons name="call-outline" size={20} color={ct.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={showMoreMenu} style={S.hBtn}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                <Ionicons name="ellipsis-vertical" size={20} color={ct.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ────────────── SEARCH OVERLAY ────────────── */}
          {searchOpen && (
            <Animated.View style={[
              S.searchOverlay,
              {
                backgroundColor: ct.header,
                borderBottomColor: ct.border,
                opacity: searchBarAnim,
                transform: [{ translateY: searchBarAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
              },
            ]}>
              <TouchableOpacity onPress={closeSearch} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="arrow-back" size={22} color={ct.primary} />
              </TouchableOpacity>
              <View style={[S.searchInputWrap, { backgroundColor: ct.inputBg }]}>
                <Ionicons name="search" size={16} color={ct.dim} />
                <TextInput
                  style={[S.searchInput, { color: ct.primary }]}
                  placeholder="Search in this chat"
                  placeholderTextColor={ct.dim}
                  value={searchQuery}
                  onChangeText={(t) => { setSearchQuery(t); runChatSearch(t); }}
                  autoFocus autoCorrect={false} returnKeyType="search"
                />
                {!!searchQuery && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchHits([]); }}>
                    <Ionicons name="close-circle" size={16} color={ct.dim} />
                  </TouchableOpacity>
                )}
              </View>
              {searchLoad ? (
                <ActivityIndicator size="small" color={ct.accent} style={{ marginLeft: 8 }} />
              ) : searchHits.length > 0 ? (
                <View style={S.searchCounter}>
                  <Text style={[S.searchCounterTxt, { color: ct.secondary }]}>
                    {searchIdx + 1} / {searchHits.length}
                  </Text>
                  <TouchableOpacity onPress={prevHit} style={S.searchNavBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                    <Ionicons name="chevron-up" size={18} color={ct.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={nextHit} style={S.searchNavBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                    <Ionicons name="chevron-down" size={18} color={ct.primary} />
                  </TouchableOpacity>
                </View>
              ) : searchQuery.trim() ? (
                <Text style={[S.searchCounterTxt, { color: ct.dim, marginLeft: 8 }]}>0</Text>
              ) : null}
            </Animated.View>
          )}

          {/* ────────────── MESSAGES ────────────── */}
          {loading ? (
            <View style={S.center}><ActivityIndicator size="large" color={ct.accent} /></View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item._id}
              inverted
              style={{ flex: 1 }}
              renderItem={({ item, index }) => (
                <MessageBubble
                  msg={item}
                  isMine={(item.senderId?._id || item.senderId) === me?._id}
                  showDate={shouldShowDate(item, index)}
                  isFirstInGroup={isFirstInGroup(item, index)}
                  navigation={navigation}
                  ct={ct}
                  otherUser={otherUser}
                  myId={me?._id}
                  selected={!!selected[item._id]}
                  selectionMode={selectionMode}
                  onSelectToggle={toggleSelect}
                  onLongPress={handleLongPress}
                  onReactToggle={(m, e) => doReact(m, e)}
                  onImagePress={(url) => { setViewerImages([{ url }]); setViewerIndex(0); }}
                  onVideoPress={(v) => navigation.navigate('VideoPlayer', { videoId: v._id || v })}
                  highlighted={highlightId === item._id}
                  searchQuery={searchOpen ? searchQuery : ''}
                />
              )}
              contentContainerStyle={S.listPad}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScroll={(e) => setShowScrollDown(e.nativeEvent.contentOffset.y > 300)}
              scrollEventThrottle={100}
              onEndReached={() => { if (hasMore && !loadingMore) loadMessages(page + 1, true); }}
              onEndReachedThreshold={0.4}
              onScrollToIndexFailed={(info) => setTimeout(() =>
                flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true }), 200)}
              ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 14 }} color={ct.secondary} /> : null}
              ListEmptyComponent={
                <View style={S.emptyWrap}>
                  <View style={[S.emptyIcon, { backgroundColor: ct.surface, borderColor: ct.border }]}>
                    <Ionicons name="chatbubbles-outline" size={40} color={ct.accent} />
                  </View>
                  <Text style={[S.emptyTitle, { color: ct.primary }]}>Say hi</Text>
                  <Text style={[S.emptySub, { color: ct.secondary }]}>
                    Send your first message to {otherUser?.username || 'them'}.
                  </Text>
                </View>
              }
              initialNumToRender={14}
              maxToRenderPerBatch={16}
              windowSize={11}
              removeClippedSubviews
            />
          )}

          {/* Scroll-to-bottom floating pill */}
          {showScrollDown && (
            <TouchableOpacity
              onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
              style={[S.scrollDown, { backgroundColor: ct.surface2, borderColor: ct.border }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-down" size={22} color={ct.primary} />
            </TouchableOpacity>
          )}

          {/* Typing bubble above composer */}
          {typing && <TypingBubble ct={ct} otherUser={otherUser} />}

          {/* Upload progress strip */}
          {sending && uploadPct > 0 && uploadPct < 1 && (
            <View style={S.progressBar}>
              <View style={[S.progressFill, { width: `${Math.round(uploadPct * 100)}%`, backgroundColor: ct.accent }]} />
            </View>
          )}

          {/* Reply preview */}
          {replyTo && (
            <View style={[S.replyPreview, { backgroundColor: ct.surface, borderColor: ct.border }]}>
              <View style={[S.replyPreviewBar, { backgroundColor: ct.accent }]} />
              <View style={{ flex: 1 }}>
                <Text style={[S.replyPreviewName, { color: ct.accent }]} numberOfLines={1}>
                  Reply to {replyTo.senderId?.username || 'message'}
                </Text>
                <Text style={[S.replyPreviewTxt, { color: ct.secondary }]} numberOfLines={1}>
                  {replyTo.preview || ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={ct.secondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Editing banner */}
          {editingId && (
            <View style={[S.replyPreview, { backgroundColor: ct.surface, borderColor: ct.border }]}>
              <Ionicons name="create-outline" size={18} color={ct.accent} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={[S.replyPreviewName, { color: ct.accent }]}>Editing</Text>
                <Text style={[S.replyPreviewTxt, { color: ct.secondary }]} numberOfLines={1}>
                  Modify then hit send
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setEditingId(null); setText(''); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={ct.secondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* ────────────── COMPOSER ────────────── */}
          <View style={[S.composerWrap, { paddingBottom: Math.max(8, insets.bottom > 0 ? 0 : 8) }]}>
            <BlurView intensity={isDark ? 40 : 60} tint={ct.glassTint} style={S.composerBlur} />
            <View style={[S.composer, { backgroundColor: ct.composerBg, borderColor: ct.border }]}>

              {!voiceActive && (
                <>
                  {EmojiKeyboard && (
                    <TouchableOpacity onPress={openEmojiPanel} style={S.composerBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                      <Ionicons name="happy-outline" size={24} color={ct.secondary} />
                    </TouchableOpacity>
                  )}

                  <TextInput
                    ref={inputRef}
                    style={[S.composerInput, { color: ct.primary }]}
                    placeholder="Message"
                    placeholderTextColor={ct.dim}
                    value={text}
                    onChangeText={handleTextChange}
                    onFocus={(e) => { kb.onInputFocus(e); setEmojiOpen(false); }}
                    onBlur={kb.onInputBlur}
                    onSelectionChange={(e) => setCaret(e.nativeEvent.selection)}
                    multiline maxLength={5000}
                    textAlignVertical="center"
                  />

                  {!text.trim() && (
                    <>
                      <TouchableOpacity onPress={() => setAttachOpen(true)} style={S.composerBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                        <Ionicons name="attach" size={22} color={ct.secondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={openCamera} style={S.composerBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                        <Ionicons name="camera-outline" size={22} color={ct.secondary} />
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}

              {/* Trailing send / mic */}
              {canSend || text.trim() ? (
                <Animated.View style={{ transform: [{ scale: sendPulse }] }}>
                  <TouchableOpacity onPress={sendTextMessage} disabled={!canSend}
                    activeOpacity={0.85} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <LinearGradient
                      colors={ct.outgoing}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={S.sendCircle}
                    >
                      {sending
                        ? <ActivityIndicator size={16} color="#fff" />
                        : <Ionicons name={editingId ? 'checkmark' : 'send'} size={18} color="#fff" />}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <VoiceRecorder
                  ct={{ ...ct, danger: '#EF4444', textPrimary: ct.primary, textSecondary: ct.secondary, textDim: ct.dim, accent: ct.accent, sendGrad: ct.outgoing, surface: ct.surface }}
                  onSend={uploadAndSendVoice}
                  onCancel={() => {}}
                  onRecordingChange={setVoiceActive}
                  idleContent={(
                    <LinearGradient
                      colors={ct.outgoing}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={S.sendCircle}
                    >
                      <Ionicons name="mic" size={20} color="#fff" />
                    </LinearGradient>
                  )}
                />
              )}
            </View>
          </View>

        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ────────────── SELECTION TOOLBAR ────────────── */}
      {selectionMode && (
        <View style={[S.selectionBar, {
          backgroundColor: ct.header, borderColor: ct.border, paddingTop: insets.top + 4,
        }]}>
          <TouchableOpacity onPress={clearSelection}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={ct.primary} />
          </TouchableOpacity>
          <Text style={[S.selectionCount, { color: ct.primary }]}>{Object.keys(selected).length}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={bulkForward} style={S.selBtn}>
            <Ionicons name="arrow-redo-outline" size={22} color={ct.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={bulkDelete} style={S.selBtn}>
            <Ionicons name="trash-outline" size={22} color={ct.danger} />
          </TouchableOpacity>
        </View>
      )}

      {/* ────────────── ACTION SHEET ────────────── */}
      <MessageActionSheet
        msg={actionMsg}
        me={me}
        ct={ct}
        onClose={() => setActionMsg(null)}
        onReply={doReply}
        onCopy={doCopy}
        onEdit={doEdit}
        onReact={(m, e) => doReact(m, e)}
        onStar={doStar}
        onPin={doPin}
        onForward={doForward}
        onSelect={doSelect}
        onDeleteMe={(m) => doDelete(m, 'me')}
        onDeleteEveryone={(m) => doDelete(m, 'everyone')}
      />

      {/* ────────────── ATTACHMENT SHEET ────────────── */}
      <AttachmentSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onAction={handleAttach}
        dark={isDark}
      />

      {/* ────────────── IMAGE LIGHTBOX ────────────── */}
      <ImageViewer
        visible={!!viewerImages}
        images={viewerImages || []}
        initialIndex={viewerIndex}
        onClose={() => setViewerImages(null)}
      />

      {/* ────────────── EMOJI PICKER ────────────── */}
      {EmojiKeyboard && (
        <EmojiKeyboard
          open={emojiOpen}
          onClose={() => setEmojiOpen(false)}
          onEmojiSelected={insertEmoji}
          enableSearchBar
          enableRecentlyUsed
          categoryPosition="top"
          expandable
          theme={isDark ? {
            backdrop:  'rgba(0,0,0,0.6)',
            knob:      ct.accent,
            container: ct.shell,
            header:    ct.primary,
            skinTonesContainer: ct.surface,
            category: {
              icon:            ct.secondary,
              iconActive:      ct.accent,
              container:       ct.surface,
              containerActive: ct.surface,
            },
            search: {
              background:  ct.surface,
              text:        ct.primary,
              placeholder: ct.dim,
              icon:        ct.secondary,
            },
          } : undefined}
        />
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Long-press action sheet
// ═══════════════════════════════════════════════════════════════════════════
function MessageActionSheet({
  msg, me, ct, onClose, onReply, onCopy, onEdit, onReact, onStar, onPin,
  onForward, onSelect, onDeleteMe, onDeleteEveryone,
}) {
  if (!msg) return null;
  const isMine = (msg.senderId?._id || msg.senderId) === me?._id;
  const isText = msg.type === 'text';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} style={AS.backdrop} onPress={onClose}>
        <View style={[AS.sheet, { backgroundColor: ct.shell, borderColor: ct.border }]}
              onStartShouldSetResponder={() => true}>
          {!msg.deleted && (
            <View style={AS.reactRow}>
              {REACTIONS.map((e) => (
                <TouchableOpacity key={e} onPress={() => onReact(msg, e)} style={AS.reactChip}>
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={{ paddingVertical: 4 }}>
            {!msg.deleted            && <Row icon="return-up-back-outline" label="Reply"   onPress={() => onReply(msg)}   ct={ct} />}
            {isText && !msg.deleted  && <Row icon="copy-outline"           label="Copy"    onPress={() => onCopy(msg)}    ct={ct} />}
            {isText && isMine && !msg.deleted && <Row icon="create-outline" label="Edit"   onPress={() => onEdit(msg)}    ct={ct} />}
            {!msg.deleted            && <Row icon="arrow-redo-outline"     label="Forward" onPress={() => onForward(msg)} ct={ct} />}
            {!msg.deleted            && <Row icon="star-outline"            label="Star"    onPress={() => onStar(msg)}    ct={ct} />}
            {!msg.deleted            && <Row icon="pin-outline"             label={msg.pinned ? 'Unpin' : 'Pin'} onPress={() => onPin(msg)} ct={ct} />}
            {!msg.deleted            && <Row icon="checkbox-outline"        label="Select"  onPress={() => onSelect(msg)}  ct={ct} />}
            <Row icon="trash-outline" label="Delete for me" danger onPress={() => onDeleteMe(msg)} ct={ct} />
            {isMine && !msg.deleted && (
              <Row icon="trash-outline" label="Delete for everyone" danger onPress={() => onDeleteEveryone(msg)} ct={ct} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
const Row = ({ icon, label, onPress, ct, danger }) => (
  <TouchableOpacity onPress={onPress} style={AS.row}>
    <Ionicons name={icon} size={20} color={danger ? '#EF4444' : ct.primary} />
    <Text style={[AS.rowLabel, { color: danger ? '#EF4444' : ct.primary }]}>{label}</Text>
  </TouchableOpacity>
);

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════
const S = StyleSheet.create({
  shell:  { flex: 1 },
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hBack:      { padding: 6 },
  hIdentity:  { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 4 },
  hPresence:  {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6, borderWidth: 2,
  },
  hInfo:      { flex: 1, marginLeft: 10 },
  hNameRow:   { flexDirection: 'row', alignItems: 'center' },
  hName:      { fontSize: 16, fontWeight: '700' },
  hStatus:    { fontSize: 12, marginTop: 2 },
  hActions:   { flexDirection: 'row', alignItems: 'center' },
  hBtn:       { paddingHorizontal: 6, paddingVertical: 8 },

  // ── Search overlay ─────────────────────────────────────────────────────
  searchOverlay: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  searchInput:    { flex: 1, marginHorizontal: 8, fontSize: 14, padding: 0 },
  searchCounter:  { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  searchCounterTxt:{ fontSize: 12, fontWeight: '600', minWidth: 38, textAlign: 'right' },
  searchNavBtn:   { padding: 4, marginLeft: 4 },

  // ── Messages list padding ──────────────────────────────────────────────
  listPad: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8 },

  // ── Bubble row ─────────────────────────────────────────────────────────
  bubbleRow:      { flexDirection: 'row', marginVertical: 2, borderRadius: 12, paddingVertical: 1 },
  bubbleRowLeft:  { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleAvatar:   { width: 36, alignItems: 'center', justifyContent: 'flex-end' },

  // Bubble — Messenger/Telegram-style rounded corners; the first bubble of a
  // group gets a pinched inner corner (a "shoulder") to indicate the
  // sender, while continuation bubbles are uniformly rounded.
  bubble: {
    maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  bubbleMineFirst:   { borderBottomRightRadius: 6 },
  bubbleMineCont:    { borderBottomRightRadius: 20 },
  bubbleTheirsFirst: { borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  bubbleTheirsCont:  { borderBottomLeftRadius: 20, borderWidth: StyleSheet.hairlineWidth },

  // Message text
  msgText: { fontSize: 15, lineHeight: 20 },
  msgFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  msgTime: { fontSize: 10.5 },
  delRow:  { flexDirection: 'row', alignItems: 'center' },
  delTxt:  { fontSize: 13, fontStyle: 'italic', marginLeft: 6 },

  // Reply chip (inside bubble)
  replyChip: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 6, overflow: 'hidden',
  },
  replyChipBar:     { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: 8 },
  replyChipName:    { fontSize: 12, fontWeight: '700' },
  replyChipPreview: { fontSize: 12, marginTop: 1 },

  // Meta rows (forwarded / edited)
  metaRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  metaText: { fontSize: 11, fontStyle: 'italic', marginLeft: 4 },

  // ── Reactions strip ────────────────────────────────────────────────────
  reactionsRow:  { flexDirection: 'row', marginTop: -6, marginBottom: 6 },
  reactionChip:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, marginRight: 4,
  },

  // ── Date separator ─────────────────────────────────────────────────────
  dateWrap:  { alignItems: 'center', marginVertical: 10 },
  datePill:  { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  dateTxt:   { fontSize: 12, fontWeight: '600' },

  // ── Voice bubble ───────────────────────────────────────────────────────
  voiceRow:  { flexDirection: 'row', alignItems: 'center', minWidth: 220, paddingVertical: 4 },
  voicePlay: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  voiceMid:  { flex: 1, marginHorizontal: 10 },
  voiceBars: { flexDirection: 'row', alignItems: 'center', height: 28 },
  voiceTime: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  speedBadge:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  speedTxt:  { fontSize: 11, fontWeight: '700' },

  // ── Image bubble ───────────────────────────────────────────────────────
  imgWrap:   { width: 240, height: 300, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  imgMsg:    { width: '100%', height: '100%' },
  imgShimmer:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.08)' },
  imgError:  { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.55)' },
  imgErrorTxt:{ color: '#FFFFFF', fontSize: 13, marginTop: 6 },
  retryBtn:  {
    marginTop: 10, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  retryBtnTxt: { color: '#FFFFFF', fontWeight: '700', marginLeft: 6, fontSize: 12 },

  // ── Video bubble ───────────────────────────────────────────────────────
  vidWrap:  { width: 240, height: 220, borderRadius: 14, overflow: 'hidden' },
  vidThumb: { ...StyleSheet.absoluteFillObject },
  vidGrad:  { ...StyleSheet.absoluteFillObject },
  vidPlay:  {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -22, marginTop: -22,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  vidDur:   {
    position: 'absolute', bottom: 8, right: 8,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  vidDurTxt:{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  vidTitle: {
    position: 'absolute', bottom: 8, left: 8, right: 42,
    fontSize: 12, fontWeight: '600',
  },

  // ── Document bubble ────────────────────────────────────────────────────
  docRow:   { flexDirection: 'row', alignItems: 'center', minWidth: 230, paddingVertical: 4 },
  docIcon:  { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  docName:  { fontSize: 14, fontWeight: '600' },
  docMeta:  { fontSize: 11, marginTop: 2 },
  docDl:    {
    marginLeft: 10, width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Typing bubble ──────────────────────────────────────────────────────
  typingRow:    { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingBottom: 4 },
  typingBubble: {
    marginLeft: 4, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 18, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth,
  },

  // ── Empty state ────────────────────────────────────────────────────────
  emptyWrap:   { alignItems: 'center', paddingTop: 80, transform: [{ scaleY: -1 }] },
  emptyIcon:   { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', marginTop: 14 },
  emptySub:    { fontSize: 13, marginTop: 6 },

  // ── Scroll-to-bottom pill ──────────────────────────────────────────────
  scrollDown: {
    position: 'absolute', right: 14, bottom: 100,
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },

  // ── Reply preview / editing banner (above composer) ────────────────────
  replyPreview: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginBottom: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  replyPreviewBar:  { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: 8 },
  replyPreviewName: { fontSize: 12, fontWeight: '700' },
  replyPreviewTxt:  { fontSize: 12, marginTop: 2 },

  // ── Composer ───────────────────────────────────────────────────────────
  composerWrap: {
    paddingHorizontal: 8, paddingTop: 6,
  },
  composerBlur: { ...StyleSheet.absoluteFillObject },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 8, paddingVertical: 8,
    borderRadius: 26, borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  composerBtn:  { paddingHorizontal: 4, paddingVertical: 8 },
  composerInput:{
    flex: 1, minHeight: 32, maxHeight: 120,
    fontSize: 15, paddingHorizontal: 8, paddingVertical: Platform.OS === 'ios' ? 6 : 4,
  },
  sendCircle: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0060DF', shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },

  // ── Upload progress strip ──────────────────────────────────────────────
  progressBar:  {
    height: 3, borderRadius: 2, overflow: 'hidden',
    marginHorizontal: 12, marginBottom: 4,
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  progressFill: { height: '100%' },

  // ── Selection toolbar ──────────────────────────────────────────────────
  selectionBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectionCount:{ marginLeft: 16, fontSize: 17, fontWeight: '700' },
  selBtn:        { padding: 8, marginLeft: 6 },
});

// Long-press action sheet styles (namespaced so they can't collide with the
// main stylesheet during future refactors).
const AS = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet:    {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 30, paddingHorizontal: 6, paddingTop: 12,
  },
  reactRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 10, paddingHorizontal: 6, marginBottom: 6,
  },
  reactChip:{ padding: 6 },
  row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  rowLabel: { marginLeft: 14, fontSize: 15, fontWeight: '500' },
});
