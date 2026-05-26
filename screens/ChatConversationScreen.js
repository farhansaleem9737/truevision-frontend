// truevision/screens/ChatConversationScreen.js
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
  StyleSheet, Platform, ActivityIndicator, Alert,
  Keyboard, KeyboardAvoidingView, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

// ─── Video Card ──────────────────────────────────────────────────────────────
const VideoCard = ({ video, onPress, isMine }) => {
  if (!video) return null;
  return (
    <TouchableOpacity style={S.vidCard} activeOpacity={0.8} onPress={onPress}>
      <Image source={{ uri: video.thumbnailUrl || 'https://via.placeholder.com/200x120/1e293b/94a3b8?text=Video' }} style={S.vidThumb} />
      <View style={S.vidPlay}><Ionicons name="play" size={18} color="#fff" /></View>
      <View style={[S.vidMeta, isMine ? S.vidMetaMine : S.vidMetaOther]}>
        <Text style={[S.vidTitle, isMine && { color: 'rgba(255,255,255,0.9)' }]} numberOfLines={2}>{video.title || 'Video'}</Text>
        {video.duration > 0 && <Text style={[S.vidDur, isMine && { color: 'rgba(255,255,255,0.5)' }]}>{Math.round(video.duration)}s</Text>}
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

const StatusTick = ({ status }) => {
  if (status === 'seen') {
    return <Ionicons name="checkmark-done" size={14} color="#38bdf8" style={{ marginLeft: 4 }} />;
  }
  if (status === 'delivered') {
    return <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.55)" style={{ marginLeft: 4 }} />;
  }
  return <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.55)" style={{ marginLeft: 4 }} />;
};

// ─── Message Bubble ──────────────────────────────────────────────────────────
// Bubble palette per theme:
//   Mine (sent)     — accent color in both modes (blue→a brighter blue in dark)
//   Theirs (received)— light gray on light, dark surface on dark
const bubblePalette = (colors, isDark) => ({
  mineBg:    colors.accent,
  theirsBg:  isDark ? '#1f1f24' : '#ffffff',
  mineText:  '#ffffff',
  theirsText: colors.text,
  mineTime:  'rgba(255,255,255,0.6)',
  theirsTime: colors.textDim,
  dateBadgeBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(100,116,139,0.1)',
  dateBadgeText: colors.textMuted,
  deletedText: colors.textDim,
});

const MessageBubble = ({ msg, isMine, showDate, navigation, palette }) => (
  <View>
    {showDate && (
      <View style={[S.dateBadge, { backgroundColor: palette.dateBadgeBg }]}>
        <Text style={[S.dateText, { color: palette.dateBadgeText }]}>{formatDate(msg.createdAt)}</Text>
      </View>
    )}
    <View style={[S.bRow, isMine ? S.bRight : S.bLeft]}>
      <View style={[
        S.bubble,
        isMine
          ? [S.bMineLayout, { backgroundColor: palette.mineBg, shadowColor: palette.mineBg }]
          : [S.bTheirsLayout, { backgroundColor: palette.theirsBg }],
        (msg.type === 'video' || msg.type === 'image') && S.bMedia,
      ]}>
        {msg.deleted ? (
          <View style={S.delRow}>
            <Ionicons name="ban-outline" size={13} color={palette.deletedText} />
            <Text style={[S.delText, { color: palette.deletedText }]}>This message was deleted</Text>
          </View>
        ) : (
          <>
            {msg.type === 'video' && msg.videoId && (
              <VideoCard video={msg.videoId} isMine={isMine} onPress={() => navigation.navigate('VideoPlayer', { videoId: msg.videoId._id || msg.videoId })} />
            )}
            {msg.type === 'image' && msg.imageUrl && <Image source={{ uri: msg.imageUrl }} style={S.imgMsg} resizeMode="cover" />}
            {msg.text ? (
              <Text style={[S.msgText, { color: isMine ? palette.mineText : palette.theirsText }]}>
                {msg.text}
              </Text>
            ) : null}
          </>
        )}
        <View style={S.msgFoot}>
          <Text style={[S.msgTime, { color: isMine ? palette.mineTime : palette.theirsTime }]}>
            {formatTime(msg.createdAt)}
          </Text>
          {isMine && !msg.deleted && <StatusTick status={deriveStatus(msg)} />}
        </View>
      </View>
    </View>
  </View>
);

// ─── Main ────────────────────────────────────────────────────────────────────
export default function ChatConversationScreen({ route, navigation }) {
  const { chatId, otherUser } = route.params;
  const { user: me }          = useAuth();
  const { colors, isDark }    = useTheme();
  const palette               = bubblePalette(colors, isDark);
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

  const shouldShowDate = (msg, idx) => {
    if (idx === messages.length - 1) return true;
    return new Date(msg.createdAt).toDateString() !== new Date(messages[idx + 1].createdAt).toDateString();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // iOS: KeyboardAvoidingView with behavior="padding" pushes the composer up.
  // Android: KAV is a no-op (behavior=undefined). Instead, useAndroidKeyboardPadding
  // applies bottom padding via the `host` View — needed because Samsung One UI
  // on RN 0.81 + new arch ignores softwareKeyboardLayoutMode="resize".
  return (
    <SafeAreaView
      style={[S.root, { backgroundColor: colors.surface }]}
      edges={Platform.OS === 'ios' ? ['top', 'bottom'] : ['top']}
    >
      <KeyboardAvoidingView
        style={S.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
      <View
        style={[S.root, { paddingBottom: kb.bottomPad }]}
        onLayout={kb.onHostLayout}
      >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[S.header, { backgroundColor: colors.bg, borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        {otherUser?.profileImage
          ? <Image source={{ uri: otherUser.profileImage }} style={S.hAvatar} />
          : <View style={[S.hAvatar, S.hAvatarFb]}><Text style={S.hIni}>{ini(otherUser?.fullName)}</Text></View>}
        <View style={S.hInfo}>
          <Text style={[S.hName, { color: colors.text }]} numberOfLines={1}>{otherUser?.username || 'User'}</Text>
          {typing ? (
            <View style={S.hStatusRow}>
              <Text style={[S.hStatus, S.hTyping, { color: colors.accent }]}>typing...</Text>
            </View>
          ) : isOnline ? (
            <View style={S.hStatusRow}>
              <View style={S.hOnline} />
              <Text style={S.hStatus}>Online</Text>
            </View>
          ) : lastSeen ? (
            <View style={S.hStatusRow}>
              <Text style={[S.hLastSeen, { color: colors.textMuted }]}>{formatLastSeen(lastSeen)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={S.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item._id}
          inverted
          style={S.list}
          renderItem={({ item, index }) => (
            <TouchableOpacity activeOpacity={0.9} onLongPress={() => handleLongPress(item)} delayLongPress={500}>
              <MessageBubble msg={item} isMine={(item.senderId?._id || item.senderId) === me?._id}
                showDate={shouldShowDate(item, index)} navigation={navigation} palette={palette} />
            </TouchableOpacity>
          )}
          contentContainerStyle={S.listPad}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onEndReached={() => { if (hasMore && !loadingMore) loadMessages(page + 1, true); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 14 }} color={colors.textMuted} /> : null}
          ListEmptyComponent={
            <View style={S.emptyWrap}>
              <View style={[S.emptyCircle, { backgroundColor: isDark ? 'rgba(96,165,250,0.15)' : '#eff6ff' }]}>
                <Ionicons name="chatbubbles-outline" size={44} color={colors.accent} />
              </View>
              <Text style={[S.emptyTitle, { color: colors.text }]}>No messages yet</Text>
              <Text style={[S.emptySub, { color: colors.textMuted }]}>
                Say hello to {otherUser?.username || 'this user'}!
              </Text>
            </View>
          }
        />
      )}

      {/* ── Typing indicator ────────────────────────────────────────────── */}
      {typing && (
        <View style={S.typingBar}>
          <View style={S.dots}><View style={[S.dot, { backgroundColor: colors.textMuted }]} /><View style={[S.dot, { opacity: 0.6, backgroundColor: colors.textMuted }]} /><View style={[S.dot, { backgroundColor: colors.textMuted }]} /></View>
          <Text style={[S.typingLabel, { color: colors.textMuted }]}>{otherUser?.username} is typing</Text>
        </View>
      )}

      {/* ── Composer ────────────────────────────────────────────────────── */}
      <View style={[S.composer, { backgroundColor: colors.bg, borderTopColor: colors.divider }]}>
        <TouchableOpacity onPress={showAttachMenu} style={S.attachBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="add-circle" size={32} color={colors.accent} />
        </TouchableOpacity>

        <View style={[S.inputWrap, { backgroundColor: colors.iconChipBg, borderColor: colors.divider }]}>
          <TextInput
            style={[S.textInput, { color: colors.text }]}
            placeholder="Message..."
            placeholderTextColor={colors.textDim}
            value={text}
            onChangeText={handleTextChange}
            onFocus={kb.onInputFocus}
            onBlur={kb.onInputBlur}
            multiline
            maxLength={5000}
            textAlignVertical="center"
          />
        </View>

        <TouchableOpacity onPress={sendTextMessage} disabled={!text.trim() || sending}
          style={[S.sendBtn, { backgroundColor: text.trim() ? colors.accent : colors.divider }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {sending
            ? <ActivityIndicator size={16} color="#fff" />
            : <Ionicons name="send" size={18} color={text.trim() ? '#fff' : colors.textDim} />}
        </TouchableOpacity>
      </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:   { flex: 1 },                         // backgroundColor injected from theme
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,  // backgroundColor + borderBottomColor injected from theme
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  backBtn:    { paddingRight: 6 },
  hAvatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: '#e2e8f0' },
  hAvatarFb:  { alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6' },
  hIni:       { color: '#fff', fontWeight: '800', fontSize: 15 },
  hInfo:      { marginLeft: 12, flex: 1 },
  hName:      { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  hStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  hOnline:    { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 5 },
  hStatus:    { fontSize: 12, color: '#22c55e', fontWeight: '500' },
  hLastSeen:  { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  hTyping:    { color: '#3b82f6', fontStyle: 'italic' },

  list:    { flex: 1 },
  listPad: { paddingHorizontal: 14, paddingVertical: 10 },

  dateBadge: { alignItems: 'center', marginVertical: 14 },
  dateText:  { backgroundColor: 'rgba(100,116,139,0.1)', color: '#64748b', fontSize: 12, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },

  bRow:     { marginBottom: 5 },
  bLeft:    { alignItems: 'flex-start' },
  bRight:   { alignItems: 'flex-end' },
  bubble:   { maxWidth: '80%', borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  // Layout-only bubble styles. Colours come from `bubblePalette(theme)` at runtime.
  bMineLayout:   { borderBottomRightRadius: 6, elevation: 1, shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  bTheirsLayout: { borderBottomLeftRadius: 6,  elevation: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  bMedia:   { paddingHorizontal: 5, paddingTop: 5 },
  msgText:  { fontSize: 15, lineHeight: 22 },
  txtMine:  { color: '#fff' },
  txtOther: { color: '#0f172a' },
  delRow:   { flexDirection: 'row', alignItems: 'center' },
  delText:  { fontStyle: 'italic', color: '#94a3b8', fontSize: 13, marginLeft: 5 },
  msgFoot:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
  msgTime:  { fontSize: 10.5, color: '#94a3b8' },
  timeMine: { color: 'rgba(255,255,255,0.5)' },

  vidCard:      { borderRadius: 12, overflow: 'hidden', marginBottom: 4, width: 210 },
  vidThumb:     { width: 210, height: 125, backgroundColor: '#1e293b' },
  vidPlay:      { position: 'absolute', top: 44, left: 88, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  vidMeta:      { paddingHorizontal: 10, paddingVertical: 6 },
  vidMetaMine:  { backgroundColor: 'rgba(255,255,255,0.1)' },
  vidMetaOther: { backgroundColor: '#f8fafc' },
  vidTitle:     { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  vidDur:       { fontSize: 11, color: '#64748b', marginTop: 2 },
  imgMsg:       { width: 210, height: 210, borderRadius: 12, marginBottom: 4 },

  emptyWrap:   { alignItems: 'center', paddingVertical: 60, transform: [{ scaleY: -1 }] },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: '#334155' },
  emptySub:    { fontSize: 14, color: '#94a3b8', marginTop: 5 },

  typingBar:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 5 },
  dots:        { flexDirection: 'row', marginRight: 8 },
  dot:         { width: 5, height: 5, borderRadius: 3, backgroundColor: '#94a3b8', marginHorizontal: 1 },
  typingLabel: { fontSize: 12, color: '#64748b', fontStyle: 'italic' },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,  // bg + borderTopColor injected from theme
  },
  attachBtn: { justifyContent: 'center', paddingBottom: 4, marginRight: 2 },
  inputWrap: {
    flex: 1, borderRadius: 24,
    marginHorizontal: 6, borderWidth: 1,        // bg + borderColor injected from theme
  },
  textInput: {
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, maxHeight: 120, minHeight: 44, // color injected from theme
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,                            // bg injected from theme based on text empty/non-empty
  },
  sendOn: {
    backgroundColor: '#3b82f6', elevation: 3,
    shadowColor: '#3b82f6', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
});
