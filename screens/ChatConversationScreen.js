// truevision/screens/ChatConversationScreen.js
//
// Premium glassmorphism chat UI. Theme-aware: a deep-black luxury palette in
// dark mode, a clean light variant in light mode. All messaging logic
// (sockets, pagination, read receipts, media, delete) is unchanged — only the
// presentation layer was redesigned.
//
// Keyboard handling — the working setup:
//
//   • Android: relies on `softwareKeyboardLayoutMode: "resize"` in app.json
//     (Expo's equivalent of AndroidManifest `windowSoftInputMode="adjustResize"`).
//     The window resizes when the keyboard opens, so the composer at the
//     bottom of the flex column stays above the keyboard automatically.
//     KeyboardAvoidingView is intentionally a no-op on Android here —
//     using `behavior="height"` on top of adjustResize causes a double
//     offset and a huge empty gap above the input.
//
//   • iOS: KeyboardAvoidingView with behavior="padding" pushes the
//     composer above the keyboard. keyboardVerticalOffset is 0 because
//     the SafeAreaView already accounts for the status-bar inset above
//     the KAV.
//
//   • FlatList is `inverted`, so the newest message renders at the visual
//     bottom — when the layout shrinks/extends, the latest message stays
//     pinned just above the composer with no manual scroll needed.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, TextInput,
  StyleSheet, Platform, ActivityIndicator, Alert, StatusBar,
  Keyboard, KeyboardAvoidingView, useWindowDimensions, Animated, Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth }     from '../context/AuthContext';
import { useTheme }    from '../context/ThemeContext';
import chatService     from '../services/ChatService';
import socketService   from '../services/SocketService';

// ─────────────────────────────────────────────────────────────────────────────
// useAndroidKeyboardPadding
//
// Samsung S21 Ultra (One UI on Android 14) + RN 0.81 + new architecture is a
// known-bad combination: `Keyboard.addListener` sometimes reports a keyboard
// height that excludes the suggestion bar, and `softwareKeyboardLayoutMode:
// "resize"` only partially shrinks the window. Either signal alone is wrong;
// together they still leave the composer behind the keyboard.
//
// This hook reads three independent signals and uses the *largest*:
//   1. `Keyboard.addListener` events                   (kbEventH)
//   2. `useWindowDimensions()` height shrink            (winShrink)
//   3. TextInput focus + 350 ms fallback estimate       (focusEstimate)
//
// Then it subtracts whatever the host View was actually shrunk by (so we
// don't double-offset on Pixel devices where adjustResize works correctly):
//
//     bottomPad = max(0, max(eventH, winShrink, focusEstimate) − hostShrink)
//
// iOS uses KeyboardAvoidingView, so the hook returns 0 there.
// ─────────────────────────────────────────────────────────────────────────────
function useAndroidKeyboardPadding(safeBottom) {
  const [kbEventH, setKbEventH] = useState(0);
  const [hostHeight, setHostHeight] = useState(0);
  const [focused, setFocused] = useState(false);
  const [focusFallback, setFocusFallback] = useState(0);

  const winH = useWindowDimensions().height;
  const initialWinH = useRef(0);
  if (winH > initialWinH.current) initialWinH.current = winH;

  const initialHostH = useRef(0);
  const focusTimer = useRef(null);

  // Signal 1: explicit keyboard events
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const apply = (e) => setKbEventH(e?.endCoordinates?.height || 0);
    const subs = [
      Keyboard.addListener('keyboardDidShow', apply),
      Keyboard.addListener('keyboardDidChangeFrame', apply),
      Keyboard.addListener('keyboardDidHide', () => setKbEventH(0)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  // Signal 3: focus-based fallback. If after 350 ms of TextInput focus we
  // still have no keyboard height (Samsung edge case where events don't
  // fire), assume ~45 % of screen height — close enough to push the composer
  // above the keyboard. Cleared on blur or as soon as a real signal arrives.
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

  // Real signals override the focus estimate as soon as they arrive
  useEffect(() => {
    if (kbEventH > 0 && focusFallback > 0) setFocusFallback(0);
  }, [kbEventH, focusFallback]);

  const onHostLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (h > initialHostH.current) initialHostH.current = h;
    setHostHeight(h);
  }, []);

  const onInputFocus = useCallback(() => setFocused(true), []);
  const onInputBlur  = useCallback(() => setFocused(false), []);

  let bottomPad;
  if (Platform.OS !== 'android') {
    bottomPad = 0;
  } else {
    const winShrink  = Math.max(0, initialWinH.current  - winH);
    const hostShrink = Math.max(0, initialHostH.current - hostHeight);
    const kbHeight   = Math.max(kbEventH, winShrink, focusFallback);

    if (kbHeight === 0) {
      bottomPad = safeBottom;
    } else {
      bottomPad = Math.max(0, kbHeight - hostShrink);
    }
  }

  return { bottomPad, onHostLayout, onInputFocus, onInputBlur };
}

// ─── Premium chat palette (theme-aware) ──────────────────────────────────────
// Dark = deep-black luxury glassmorphism; light = clean frosted variant.
const chatTheme = (isDark) => isDark ? {
  base:        '#050505',
  bgGradient:  ['#050505', '#0A0A0A', '#050505'],
  glow:        '59,130,246',                 // rgb for the ambient blue halo
  glassTint:   'dark',
  headerBg:    'rgba(10,10,10,0.55)',
  surface:     'rgba(255,255,255,0.05)',
  border:      'rgba(255,255,255,0.08)',
  textPrimary: '#FFFFFF',
  textSecondary:'rgba(255,255,255,0.65)',
  textDim:     'rgba(255,255,255,0.40)',
  theirsBubble:'rgba(255,255,255,0.06)',
  theirsText:  '#FFFFFF',
  theirsTime:  'rgba(255,255,255,0.40)',
  mineGrad:    ['#3B82F6', '#2563EB'],
  mineText:    '#FFFFFF',
  mineTime:    'rgba(255,255,255,0.70)',
  composerBg:  'rgba(20,20,22,0.55)',
  inputBg:     'rgba(255,255,255,0.06)',
  sendGrad:    ['#3B82F6', '#2563EB'],
  online:      '#22C55E',
  accent:      '#3B82F6',
  dateBadge:   'rgba(255,255,255,0.07)',
  statusBar:   'light-content',
} : {
  base:        '#FFFFFF',
  bgGradient:  ['#FFFFFF', '#F4F7FB', '#FFFFFF'],
  glow:        '59,130,246',
  glassTint:   'light',
  headerBg:    'rgba(255,255,255,0.6)',
  surface:     'rgba(15,23,42,0.04)',
  border:      'rgba(15,23,42,0.08)',
  textPrimary: '#0F172A',
  textSecondary:'#64748B',
  textDim:     '#94A3B8',
  theirsBubble:'#FFFFFF',
  theirsText:  '#0F172A',
  theirsTime:  '#94A3B8',
  mineGrad:    ['#3B82F6', '#2563EB'],
  mineText:    '#FFFFFF',
  mineTime:    'rgba(255,255,255,0.75)',
  composerBg:  'rgba(255,255,255,0.6)',
  inputBg:     'rgba(15,23,42,0.05)',
  sendGrad:    ['#3B82F6', '#2563EB'],
  online:      '#22C55E',
  accent:      '#3B82F6',
  dateBadge:   'rgba(15,23,42,0.06)',
  statusBar:   'dark-content',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatTime = (d) => d ? new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
const formatDate = (d) => {
  if (!d) return '';
  const date = new Date(d), now = new Date();
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yest.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
const ini = (n) => n ? n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';

// Human-friendly "last seen" text
const formatLastSeen = (d) => {
  if (!d) return '';
  const diff = Math.max(0, Date.now() - new Date(d).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1)     return 'Last seen just now';
  if (mins < 60)    return `Last seen ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)     return `Last seen ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)     return `Last seen ${days}d ago`;
  return `Last seen ${new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};

// ─── Avatar ──────────────────────────────────────────────────────────────────
// Circular avatar placeholder — image when available, gradient + initials fallback.
const Avatar = ({ uri, name, size = 40, ct }) => {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <LinearGradient
      colors={['#3B82F6', '#2563EB']}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.36 }}>{ini(name)}</Text>
    </LinearGradient>
  );
};

// ─── Animated typing dots ────────────────────────────────────────────────────
function TypingDots({ color }) {
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;
  const dots = [d1, d2, d3];

  useEffect(() => {
    const make = (v, delay) => Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 380, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(220),
      ])
    );
    const anims = dots.map((v, i) => make(v, i * 150));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7, height: 7, borderRadius: 4, marginHorizontal: 2.5, backgroundColor: color,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Video Card ──────────────────────────────────────────────────────────────
const VideoCard = ({ video, onPress, isMine, ct }) => {
  if (!video) return null;
  return (
    <TouchableOpacity style={S.vidCard} activeOpacity={0.85} onPress={onPress}>
      <Image source={{ uri: video.thumbnailUrl || 'https://via.placeholder.com/200x120/0a0a0a/3b82f6?text=Video' }} style={S.vidThumb} />
      <View style={S.vidPlay}><Ionicons name="play" size={18} color="#fff" /></View>
      <View style={[S.vidMeta, { backgroundColor: isMine ? 'rgba(255,255,255,0.12)' : ct.surface }]}>
        <Text style={[S.vidTitle, { color: isMine ? 'rgba(255,255,255,0.95)' : ct.textPrimary }]} numberOfLines={2}>{video.title || 'Video'}</Text>
        {video.duration > 0 && <Text style={[S.vidDur, { color: isMine ? 'rgba(255,255,255,0.6)' : ct.textSecondary }]}>{Math.round(video.duration)}s</Text>}
      </View>
    </TouchableOpacity>
  );
};

// Derive a three-state status from either the new `status` field or the legacy `seen` boolean
const deriveStatus = (msg) => {
  if (msg.status) return msg.status;            // new field wins
  if (msg.seen)   return 'seen';                // legacy fallback
  return 'sent';
};

// Read-receipt ticks (sent / delivered / seen)
const StatusTick = ({ status }) => {
  if (status === 'seen') {
    return <Ionicons name="checkmark-done" size={14} color="#BAE6FD" style={{ marginLeft: 4 }} />;
  }
  if (status === 'delivered') {
    return <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
  }
  return <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
};

// ─── Message Bubble ──────────────────────────────────────────────────────────
//   Mine (sent)      — blue gradient bubble, right aligned, read receipt.
//   Theirs (received)— translucent glass bubble with avatar, left aligned.
const MessageBubble = ({ msg, isMine, showDate, navigation, ct, otherUser }) => {
  const textColor = isMine ? ct.mineText : ct.theirsText;
  const timeColor = isMine ? ct.mineTime : ct.theirsTime;
  const isMedia   = msg.type === 'video' || msg.type === 'image';

  const inner = (
    <>
      {msg.deleted ? (
        <View style={S.delRow}>
          <Ionicons name="ban-outline" size={13} color={timeColor} />
          <Text style={[S.delText, { color: timeColor }]}>This message was deleted</Text>
        </View>
      ) : (
        <>
          {msg.type === 'video' && msg.videoId && (
            <VideoCard video={msg.videoId} isMine={isMine} ct={ct}
              onPress={() => navigation.navigate('VideoPlayer', { videoId: msg.videoId._id || msg.videoId })} />
          )}
          {msg.type === 'image' && msg.imageUrl && <Image source={{ uri: msg.imageUrl }} style={S.imgMsg} resizeMode="cover" />}
          {msg.text ? <Text style={[S.msgText, { color: textColor }]}>{msg.text}</Text> : null}
        </>
      )}
      <View style={S.msgFoot}>
        <Text style={[S.msgTime, { color: timeColor }]}>{formatTime(msg.createdAt)}</Text>
        {isMine && !msg.deleted && <StatusTick status={deriveStatus(msg)} />}
      </View>
    </>
  );

  return (
    <View>
      {showDate && (
        <View style={S.dateBadgeWrap}>
          <Text style={[S.dateText, { backgroundColor: ct.dateBadge, color: ct.textSecondary }]}>{formatDate(msg.createdAt)}</Text>
        </View>
      )}
      <View style={[S.bRow, isMine ? S.bRight : S.bLeft]}>
        {!isMine && (
          <View style={S.bAvatar}>
            <Avatar uri={otherUser?.profileImage} name={otherUser?.fullName || otherUser?.username} size={28} ct={ct} />
          </View>
        )}
        {isMine ? (
          <LinearGradient
            colors={ct.mineGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[S.bubble, S.bMine, S.bMineShadow, isMedia && S.bMedia]}
          >
            {inner}
          </LinearGradient>
        ) : (
          <View style={[S.bubble, S.bTheirs, { backgroundColor: ct.theirsBubble, borderColor: ct.border }, isMedia && S.bMedia]}>
            {inner}
          </View>
        )}
      </View>
    </View>
  );
};

// ─── Main ────────────────────────────────────────────────────────────────────
export default function ChatConversationScreen({ route, navigation }) {
  const { chatId, otherUser } = route.params;
  const { user: me }          = useAuth();
  const { isDark }            = useTheme();
  const ct                    = chatTheme(isDark);
  const insets                = useSafeAreaInsets();
  const kb                    = useAndroidKeyboardPadding(insets.bottom);

  const [messages, setMessages]       = useState([]);
  const [text, setText]               = useState('');
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState(false);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typing, setTyping]           = useState(false);
  const [isOnline, setIsOnline]       = useState(!!otherUser?.isOnline);
  const [lastSeen, setLastSeen]       = useState(otherUser?.lastSeen || null);

  const flatListRef = useRef(null);
  const typingTimer = useRef(null);

  // ── Load messages ──────────────────────────────────────────────────────
  const loadMessages = useCallback(async (p = 1, append = false) => {
    if (p > 1) setLoadingMore(true);
    const res = await chatService.getMessages(chatId, p);
    if (res.success) {
      const reversed = [...(res.messages || [])].reverse();
      if (append) setMessages(prev => [...prev, ...reversed]);
      else setMessages(reversed);
      setHasMore(res.hasMore);
      setPage(p);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [chatId]);

  useEffect(() => { loadMessages(1); chatService.markAsRead(chatId); }, [loadMessages, chatId]);

  // ── Socket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    socketService.connect();
    socketService.emit('joinChat', chatId);
    socketService.emit('markSeen', { chatId });
    const unsubs = [
      socketService.on('newMessage', (msg) => {
        if (msg.chatId === chatId) {
          setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [msg, ...prev]);
          if (msg.senderId?._id !== me?._id && msg.senderId !== me?._id) socketService.emit('markSeen', { chatId });
        }
      }),
      socketService.on('messageSeen', ({ chatId: c }) => {
        if (c !== chatId) return;
        setMessages(prev => prev.map(m => ({ ...m, status: 'seen', seen: true })));
      }),
      socketService.on('messageDelivered', ({ chatId: c, messageId }) => {
        if (c !== chatId) return;
        setMessages(prev => prev.map(m =>
          m._id === messageId && m.status !== 'seen'
            ? { ...m, status: 'delivered' }
            : m
        ));
      }),
      socketService.on('messagesDelivered', ({ items }) => {
        const idsForThisChat = new Set(
          (items || []).filter(i => i.chatId === chatId).map(i => i.messageId)
        );
        if (!idsForThisChat.size) return;
        setMessages(prev => prev.map(m =>
          idsForThisChat.has(m._id) && m.status !== 'seen'
            ? { ...m, status: 'delivered' }
            : m
        ));
      }),
      socketService.on('typing',     ({ chatId: c, userId: u }) => { if (c === chatId && u !== me?._id) setTyping(true); }),
      socketService.on('stopTyping', ({ chatId: c, userId: u }) => { if (c === chatId && u !== me?._id) setTyping(false); }),
      socketService.on('userOnline',  ({ userId: u }) => { if (u === otherUser?._id) setIsOnline(true); }),
      socketService.on('userOffline', ({ userId: u, lastSeen: ls }) => {
        if (u !== otherUser?._id) return;
        setIsOnline(false);
        if (ls) setLastSeen(ls);
      }),
    ];
    return () => { socketService.emit('leaveChat', chatId); unsubs.forEach(fn => fn()); };
  }, [chatId, me?._id, otherUser?._id]);

  // ── Actions ────────────────────────────────────────────────────────────
  const sendTextMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true); setText('');
    socketService.emit('stopTyping', { chatId });
    const socket = socketService.getSocket();
    if (socket?.connected) {
      socketService.emit('sendMessage', { chatId, text: trimmed, type: 'text' }, (res) => {
        if (!res?.success) chatService.sendMessage(chatId, { text: trimmed });
        setSending(false);
      });
    } else {
      await chatService.sendMessage(chatId, { text: trimmed });
      loadMessages(1); setSending(false);
    }
  };

  const sendVideoMessage = (videoId) => {
    const s = socketService.getSocket();
    if (s?.connected) socketService.emit('sendMessage', { chatId, type: 'video', videoId, text: '' });
    else chatService.sendMessage(chatId, { type: 'video', videoId });
  };

  const pickAndSendImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Required', 'Media library permission is needed.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const s = socketService.getSocket();
      if (s?.connected) socketService.emit('sendMessage', { chatId, type: 'image', imageUrl: uri, text: '' });
      else chatService.sendMessage(chatId, { type: 'image', imageUrl: uri });
    }
  };

  const handleTextChange = (t) => {
    setText(t);
    socketService.emit('typing', { chatId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socketService.emit('stopTyping', { chatId }), 2000);
  };

  const showAttachMenu = () => {
    Keyboard.dismiss();
    Alert.alert('Share', 'What would you like to share?', [
      { text: 'Video from TrueVision', onPress: () => navigation.navigate('ShareVideo', { chatId, onSelectVideo: sendVideoMessage }) },
      { text: 'Photo from Gallery', onPress: pickAndSendImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleLongPress = (msg) => {
    if ((msg.senderId?._id || msg.senderId) !== me?._id) return;
    Alert.alert('Delete Message', 'Unsend this message?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const res = await chatService.deleteMessage(chatId, msg._id);
        if (res.success) setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, deleted: true, text: '' } : m));
      }},
    ]);
  };

  const startCall = (kind) =>
    Alert.alert(`${kind} call`, `${kind} calling will be available soon.`);

  const shouldShowDate = (msg, idx) => {
    if (idx === messages.length - 1) return true;
    return new Date(msg.createdAt).toDateString() !== new Date(messages[idx + 1].createdAt).toDateString();
  };

  const canSend = !!text.trim() && !sending;

  // ══════════════════════════════════════════════════════════════════════════
  // iOS: KeyboardAvoidingView with behavior="padding" pushes the composer up.
  // Android: KAV is a no-op (behavior=undefined). Instead, useAndroidKeyboardPadding
  // applies bottom padding via the `host` View — needed because Samsung One UI
  // on RN 0.81 + new arch ignores softwareKeyboardLayoutMode="resize".
  return (
    <View style={[S.shell, { backgroundColor: ct.base }]}>
      {/* Deep gradient canvas + soft blue ambient glow behind the header */}
      <LinearGradient colors={ct.bgGradient} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={S.glowWrap}>
        <View style={[S.glow, { width: 460, height: 460, borderRadius: 230, backgroundColor: `rgba(${ct.glow},0.05)` }]} />
        <View style={[S.glow, { width: 320, height: 320, borderRadius: 160, backgroundColor: `rgba(${ct.glow},0.07)` }]} />
        <View style={[S.glow, { width: 200, height: 200, borderRadius: 100, backgroundColor: `rgba(${ct.glow},0.09)` }]} />
      </View>

      <StatusBar barStyle={ct.statusBar} backgroundColor="transparent" translucent />

      <SafeAreaView
        style={S.root}
        edges={Platform.OS === 'ios' ? ['top', 'bottom'] : ['top']}
      >
        <KeyboardAvoidingView
          style={S.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
        <View style={[S.root, { paddingBottom: kb.bottomPad }]} onLayout={kb.onHostLayout}>

          {/* ── Header (glass, sticky) ─────────────────────────────────────── */}
          <BlurView intensity={isDark ? 40 : 60} tint={ct.glassTint}
            style={[S.header, { backgroundColor: ct.headerBg, borderBottomColor: ct.border }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={S.iconBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="chevron-back" size={26} color={ct.textPrimary} />
            </TouchableOpacity>

            <View style={S.hAvatarWrap}>
              <Avatar uri={otherUser?.profileImage} name={otherUser?.fullName || otherUser?.username} size={42} ct={ct} />
              {/* Online/offline indicator dot */}
              <View style={[S.presenceDot, {
                backgroundColor: isOnline ? ct.online : ct.textDim,
                borderColor: ct.base,
              }]} />
            </View>

            <View style={S.hInfo}>
              <Text style={[S.hName, { color: ct.textPrimary }]} numberOfLines={1}>
                {otherUser?.username || 'User'}
              </Text>
              {typing ? (
                <Text style={[S.hStatus, { color: ct.accent }]}>typing…</Text>
              ) : isOnline ? (
                <Text style={[S.hStatus, { color: ct.online }]}>Online</Text>
              ) : lastSeen ? (
                <Text style={[S.hStatus, { color: ct.textSecondary }]}>{formatLastSeen(lastSeen)}</Text>
              ) : null}
            </View>

            {/* Voice + video call actions */}
            <TouchableOpacity onPress={() => startCall('Voice')} style={S.callBtn}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
              <Ionicons name="call-outline" size={21} color={ct.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => startCall('Video')} style={S.callBtn}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
              <Ionicons name="videocam-outline" size={23} color={ct.textPrimary} />
            </TouchableOpacity>
          </BlurView>

          {/* ── Messages ───────────────────────────────────────────────────── */}
          {loading ? (
            <View style={S.center}><ActivityIndicator size="large" color={ct.accent} /></View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item._id}
              inverted
              style={S.list}
              renderItem={({ item, index }) => (
                <TouchableOpacity activeOpacity={0.9} onLongPress={() => handleLongPress(item)} delayLongPress={500}>
                  <MessageBubble
                    msg={item}
                    isMine={(item.senderId?._id || item.senderId) === me?._id}
                    showDate={shouldShowDate(item, index)}
                    navigation={navigation}
                    ct={ct}
                    otherUser={otherUser}
                  />
                </TouchableOpacity>
              )}
              contentContainerStyle={S.listPad}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onEndReached={() => { if (hasMore && !loadingMore) loadMessages(page + 1, true); }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 14 }} color={ct.textSecondary} /> : null}
              ListEmptyComponent={
                <View style={S.emptyWrap}>
                  <View style={[S.emptyCircle, { backgroundColor: ct.surface, borderColor: ct.border }]}>
                    <Ionicons name="chatbubbles-outline" size={42} color={ct.accent} />
                  </View>
                  <Text style={[S.emptyTitle, { color: ct.textPrimary }]}>No messages yet</Text>
                  <Text style={[S.emptySub, { color: ct.textSecondary }]}>
                    Say hello to {otherUser?.username || 'this user'}!
                  </Text>
                </View>
              }
            />
          )}

          {/* ── Typing indicator (avatar + glass bubble + animated dots) ────── */}
          {typing && (
            <View style={S.typingRow}>
              <Avatar uri={otherUser?.profileImage} name={otherUser?.fullName || otherUser?.username} size={26} ct={ct} />
              <View style={[S.typingBubble, { backgroundColor: ct.theirsBubble, borderColor: ct.border }]}>
                <TypingDots color={ct.textSecondary} />
              </View>
            </View>
          )}

          {/* ── Composer (floating glass) ──────────────────────────────────── */}
          <View style={S.composerWrap}>
            <BlurView intensity={isDark ? 40 : 60} tint={ct.glassTint}
              style={[S.composer, { backgroundColor: ct.composerBg, borderColor: ct.border }]}>
              {/* Camera button */}
              <TouchableOpacity onPress={showAttachMenu}
                style={[S.circleBtn, { backgroundColor: ct.surface, borderColor: ct.border }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="camera-outline" size={21} color={ct.textSecondary} />
              </TouchableOpacity>

              {/* Text field */}
              <View style={[S.inputWrap, { backgroundColor: ct.inputBg }]}>
                <TextInput
                  style={[S.textInput, { color: ct.textPrimary }]}
                  placeholder="Message…"
                  placeholderTextColor={ct.textDim}
                  value={text}
                  onChangeText={handleTextChange}
                  onFocus={kb.onInputFocus}
                  onBlur={kb.onInputBlur}
                  multiline
                  maxLength={5000}
                  textAlignVertical="center"
                />
              </View>

              {/* Send button */}
              <TouchableOpacity onPress={sendTextMessage} disabled={!canSend}
                activeOpacity={0.85} style={S.sendTouch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {canSend ? (
                  <LinearGradient colors={ct.sendGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[S.circleBtn, S.sendOn]}>
                    {sending
                      ? <ActivityIndicator size={16} color="#fff" />
                      : <Ionicons name="send" size={18} color="#fff" />}
                  </LinearGradient>
                ) : (
                  <View style={[S.circleBtn, { backgroundColor: ct.surface, borderColor: ct.border }]}>
                    {sending
                      ? <ActivityIndicator size={16} color={ct.textDim} />
                      : <Ionicons name="send" size={18} color={ct.textDim} />}
                  </View>
                )}
              </TouchableOpacity>
            </BlurView>
          </View>

        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  shell:  { flex: 1 },
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Ambient blue glow, anchored just under the status bar / header.
  glowWrap: { position: 'absolute', top: -160, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', height: 460 },
  glow:     { position: 'absolute' },

  // ── Header ──
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn:     { paddingRight: 4 },
  hAvatarWrap: { width: 42, height: 42, marginLeft: 4 },
  presenceDot: {
    position: 'absolute', right: -1, bottom: -1,
    width: 12, height: 12, borderRadius: 6, borderWidth: 2,
  },
  hInfo:    { marginLeft: 12, flex: 1 },
  hName:    { fontSize: 16.5, fontWeight: '700', letterSpacing: 0.2 },
  hStatus:  { fontSize: 12, fontWeight: '500', marginTop: 2 },
  callBtn:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },

  // ── Messages ──
  list:    { flex: 1 },
  listPad: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },

  dateBadgeWrap: { alignItems: 'center', marginVertical: 16 },
  dateText:      { fontSize: 11.5, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },

  bRow:    { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  bLeft:   { justifyContent: 'flex-start' },
  bRight:  { justifyContent: 'flex-end' },
  bAvatar: { marginRight: 8, marginBottom: 2 },

  bubble:  { maxWidth: '75%', borderRadius: 22, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 7 },
  bMine:   { borderBottomRightRadius: 7 },
  bTheirs: { borderBottomLeftRadius: 7, borderWidth: 1 },
  bMineShadow: {
    shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  bMedia:  { paddingHorizontal: 6, paddingTop: 6 },

  msgText: { fontSize: 15, lineHeight: 22 },
  delRow:  { flexDirection: 'row', alignItems: 'center' },
  delText: { fontStyle: 'italic', fontSize: 13, marginLeft: 5 },
  msgFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
  msgTime: { fontSize: 10.5 },

  // ── Media inside bubbles ──
  vidCard:  { borderRadius: 14, overflow: 'hidden', marginBottom: 4, width: 212 },
  vidThumb: { width: 212, height: 126, backgroundColor: '#0a0a0a' },
  vidPlay:  { position: 'absolute', top: 46, left: 89, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  vidMeta:  { paddingHorizontal: 10, paddingVertical: 7 },
  vidTitle: { fontSize: 13, fontWeight: '600' },
  vidDur:   { fontSize: 11, marginTop: 2 },
  imgMsg:   { width: 212, height: 212, borderRadius: 14, marginBottom: 4 },

  // ── Empty state (list is inverted, so flip it back upright) ──
  emptyWrap:   { alignItems: 'center', paddingVertical: 64, transform: [{ scaleY: -1 }] },
  emptyCircle: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1 },
  emptyTitle:  { fontSize: 18, fontWeight: '700' },
  emptySub:    { fontSize: 14, marginTop: 6 },

  // ── Typing indicator ──
  typingRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  typingBubble: { marginLeft: 8, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18, borderBottomLeftRadius: 6, borderWidth: 1 },

  // ── Composer (floating glass) ──
  composerWrap: {
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8,
  },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 8, paddingVertical: 8,
    borderRadius: 30, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  circleBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  inputWrap: {
    flex: 1, borderRadius: 22, marginHorizontal: 8,
    minHeight: 44, justifyContent: 'center',
  },
  textInput: {
    paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11,
    fontSize: 15, maxHeight: 120, minHeight: 44,
  },
  sendTouch: {},
  sendOn: {
    borderWidth: 0,
    shadowColor: '#2563EB', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
