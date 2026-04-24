// truevision/screens/ChatConversationScreen.js
//
// FINAL KEYBOARD SOLUTION — what actually caused every previous failure:
//
//   Android back button dismisses keyboard but does NOT trigger onBlur.
//   TextInput retains focus (cursor stays visible) while keyboard is hidden.
//   If we use `focused` state to decide padding → padding stays forever → huge gap.
//
//   This solution uses a single `kbPadding` state driven by THREE independent signals:
//     1. Keyboard.addListener → sets exact height, clears on hide
//     2. onFocus + 500ms delay → fallback estimate if events didn't fire
//     3. onBlur / BackHandler / scroll-dismiss → clears padding immediately
//
//   onLayout detects whether adjustResize already handled it → prevents double offset.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, TextInput,
  StyleSheet, Platform, ActivityIndicator, Alert, Dimensions,
  Keyboard, LayoutAnimation, UIManager, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth }     from '../context/AuthContext';
import chatService     from '../services/ChatService';
import socketService   from '../services/SocketService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SCREEN_HEIGHT = Dimensions.get('screen').height;

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

// ─── Message Bubble ──────────────────────────────────────────────────────────
const MessageBubble = ({ msg, isMine, showDate, navigation }) => (
  <View>
    {showDate && <View style={S.dateBadge}><Text style={S.dateText}>{formatDate(msg.createdAt)}</Text></View>}
    <View style={[S.bRow, isMine ? S.bRight : S.bLeft]}>
      <View style={[S.bubble, isMine ? S.bMine : S.bTheirs, (msg.type === 'video' || msg.type === 'image') && S.bMedia]}>
        {msg.deleted ? (
          <View style={S.delRow}><Ionicons name="ban-outline" size={13} color="#94a3b8" /><Text style={S.delText}>This message was deleted</Text></View>
        ) : (
          <>
            {msg.type === 'video' && msg.videoId && (
              <VideoCard video={msg.videoId} isMine={isMine} onPress={() => navigation.navigate('VideoPlayer', { videoId: msg.videoId._id || msg.videoId })} />
            )}
            {msg.type === 'image' && msg.imageUrl && <Image source={{ uri: msg.imageUrl }} style={S.imgMsg} resizeMode="cover" />}
            {msg.text ? <Text style={[S.msgText, isMine ? S.txtMine : S.txtOther]}>{msg.text}</Text> : null}
          </>
        )}
        <View style={S.msgFoot}>
          <Text style={[S.msgTime, isMine && S.timeMine]}>{formatTime(msg.createdAt)}</Text>
          {isMine && !msg.deleted && (
            <Ionicons name={msg.seen ? 'checkmark-done' : 'checkmark'} size={14}
              color={msg.seen ? '#93c5fd' : 'rgba(255,255,255,0.4)'} style={{ marginLeft: 4 }} />
          )}
        </View>
      </View>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// useSmartKeyboard — three independent keyboard detection signals
// ─────────────────────────────────────────────────────────────────────────────
function useSmartKeyboard(insetBottom) {
  const [kbPadding, setKbPadding] = useState(0);
  const [rootH, setRootH]         = useState(0);
  const initialH                   = useRef(0);
  const kbFromEvents               = useRef(0);   // height from Keyboard API (0 = not set)
  const focusTimer                 = useRef(null);

  // ── Signal 1: Keyboard.addListener (exact height when it works) ────────
  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const s1 = Keyboard.addListener(showEv, (e) => {
      clearTimeout(focusTimer.current);
      kbFromEvents.current = e.endCoordinates.height;
      setKbPadding(e.endCoordinates.height);
    });
    const s2 = Keyboard.addListener(hideEv, () => {
      clearTimeout(focusTimer.current);
      kbFromEvents.current = 0;
      setKbPadding(0);
    });
    return () => { s1.remove(); s2.remove(); };
  }, []);

  // ── Signal 3: BackHandler — clear padding when Android back is pressed ──
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (kbPadding > 0) {
        clearTimeout(focusTimer.current);
        kbFromEvents.current = 0;
        setKbPadding(0);
        Keyboard.dismiss();
        return true; // consume the event, don't navigate back
      }
      return false; // let navigation handle it
    });
    return () => sub.remove();
  }, [kbPadding]);

  // ── onLayout — detect adjustResize ─────────────────────────────────────
  const onRootLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (initialH.current === 0) initialH.current = h;
    setRootH(h);
  }, []);

  const systemResized = initialH.current > 0 && (initialH.current - rootH) > 50;

  // ── Signal 2: onFocus with delay (fallback for edge-to-edge Expo Go) ───
  const onInputFocus = useCallback(() => {
    clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      // Only apply fallback if NOTHING ELSE handled the keyboard
      if (kbFromEvents.current === 0 && !systemResized) {
        setKbPadding(Math.round(SCREEN_HEIGHT * 0.42));
      }
    }, 500);
  }, [systemResized]);

  const onInputBlur = useCallback(() => {
    clearTimeout(focusTimer.current);
    // Only clear if WE set it via fallback (not if events set it — events will clear via keyboardDidHide)
    if (kbFromEvents.current === 0) {
      setKbPadding(0);
    }
  }, []);

  // Force clear — called when user scrolls the message list
  const dismissKeyboard = useCallback(() => {
    clearTimeout(focusTimer.current);
    Keyboard.dismiss();
    if (kbFromEvents.current === 0) {
      setKbPadding(0);
    }
  }, []);

  // ── Final padding ──────────────────────────────────────────────────────
  // systemResized → adjustResize already moved input → add 0
  // kbPadding > 0 → keyboard is open (from events or fallback) → use that value
  // else → keyboard closed → use safe area bottom inset
  const bottomPad = systemResized ? 0 : (kbPadding > 0 ? kbPadding : insetBottom);

  return { bottomPad, onRootLayout, onInputFocus, onInputBlur, dismissKeyboard };
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function ChatConversationScreen({ route, navigation }) {
  const { chatId, otherUser } = route.params;
  const { user: me }         = useAuth();
  const insets                = useSafeAreaInsets();
  const kb                    = useSmartKeyboard(insets.bottom);

  const [messages, setMessages]       = useState([]);
  const [text, setText]               = useState('');
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState(false);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typing, setTyping]           = useState(false);
  const [isOnline, setIsOnline]       = useState(false);

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
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [msg, ...prev]);
          if (msg.senderId?._id !== me?._id && msg.senderId !== me?._id) socketService.emit('markSeen', { chatId });
        }
      }),
      socketService.on('messageSeen', ({ chatId: c }) => { if (c === chatId) setMessages(prev => prev.map(m => ({ ...m, seen: true }))); }),
      socketService.on('typing',     ({ chatId: c, userId: u }) => { if (c === chatId && u !== me?._id) setTyping(true); }),
      socketService.on('stopTyping', ({ chatId: c, userId: u }) => { if (c === chatId && u !== me?._id) setTyping(false); }),
      socketService.on('userOnline',  ({ userId: u }) => { if (u === otherUser?._id) setIsOnline(true); }),
      socketService.on('userOffline', ({ userId: u }) => { if (u === otherUser?._id) setIsOnline(false); }),
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
    kb.dismissKeyboard();
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
  return (
    <View
      style={[S.root, { paddingTop: insets.top, paddingBottom: kb.bottomPad }]}
      onLayout={kb.onRootLayout}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color="#0f172a" />
        </TouchableOpacity>
        {otherUser?.profileImage
          ? <Image source={{ uri: otherUser.profileImage }} style={S.hAvatar} />
          : <View style={[S.hAvatar, S.hAvatarFb]}><Text style={S.hIni}>{ini(otherUser?.fullName)}</Text></View>}
        <View style={S.hInfo}>
          <Text style={S.hName} numberOfLines={1}>{otherUser?.username || 'User'}</Text>
          {(typing || isOnline) && (
            <View style={S.hStatusRow}>
              {!typing && <View style={S.hOnline} />}
              <Text style={[S.hStatus, typing && S.hTyping]}>{typing ? 'typing...' : 'Online'}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={S.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
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
                showDate={shouldShowDate(item, index)} navigation={navigation} />
            </TouchableOpacity>
          )}
          contentContainerStyle={S.listPad}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          onScrollBeginDrag={kb.dismissKeyboard}
          onEndReached={() => { if (hasMore && !loadingMore) loadMessages(page + 1, true); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 14 }} color="#94a3b8" /> : null}
          ListEmptyComponent={
            <View style={S.emptyWrap}>
              <View style={S.emptyCircle}><Ionicons name="chatbubbles-outline" size={44} color="#93c5fd" /></View>
              <Text style={S.emptyTitle}>No messages yet</Text>
              <Text style={S.emptySub}>Say hello to {otherUser?.username || 'this user'}!</Text>
            </View>
          }
        />
      )}

      {/* ── Typing indicator ────────────────────────────────────────────── */}
      {typing && (
        <View style={S.typingBar}>
          <View style={S.dots}><View style={S.dot} /><View style={[S.dot, { opacity: 0.6 }]} /><View style={S.dot} /></View>
          <Text style={S.typingLabel}>{otherUser?.username} is typing</Text>
        </View>
      )}

      {/* ── Composer ────────────────────────────────────────────────────── */}
      <View style={S.composer}>
        <TouchableOpacity onPress={showAttachMenu} style={S.attachBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="add-circle" size={32} color="#3b82f6" />
        </TouchableOpacity>

        <View style={S.inputWrap}>
          <TextInput
            style={S.textInput}
            placeholder="Message..."
            placeholderTextColor="#94a3b8"
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
          style={[S.sendBtn, text.trim() && S.sendOn]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {sending
            ? <ActivityIndicator size={16} color="#fff" />
            : <Ionicons name="send" size={18} color={text.trim() ? '#fff' : '#94a3b8'} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#f0f4f8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#dde3ea',
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
  hTyping:    { color: '#3b82f6', fontStyle: 'italic' },

  list:    { flex: 1 },
  listPad: { paddingHorizontal: 14, paddingVertical: 10 },

  dateBadge: { alignItems: 'center', marginVertical: 14 },
  dateText:  { backgroundColor: 'rgba(100,116,139,0.1)', color: '#64748b', fontSize: 12, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },

  bRow:     { marginBottom: 5 },
  bLeft:    { alignItems: 'flex-start' },
  bRight:   { alignItems: 'flex-end' },
  bubble:   { maxWidth: '80%', borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  bMine:    { backgroundColor: '#3b82f6', borderBottomRightRadius: 6, elevation: 1, shadowColor: '#3b82f6', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  bTheirs:  { backgroundColor: '#fff', borderBottomLeftRadius: 6, elevation: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
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
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#dde3ea',
  },
  attachBtn: { justifyContent: 'center', paddingBottom: 4, marginRight: 2 },
  inputWrap: {
    flex: 1, backgroundColor: '#f1f5f9', borderRadius: 24,
    marginHorizontal: 6, borderWidth: 1, borderColor: '#e2e8f0',
  },
  textInput: {
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, color: '#0f172a', maxHeight: 120, minHeight: 44,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2, backgroundColor: '#e2e8f0',
  },
  sendOn: {
    backgroundColor: '#3b82f6', elevation: 3,
    shadowColor: '#3b82f6', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
});
