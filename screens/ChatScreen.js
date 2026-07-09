// truevision/screens/ChatScreen.js
//
// Chat inbox — messenger-style conversation list.
//
// Features
//   • Modern cards with avatar, verified badge slot, online dot, mute/pin
//     icons, last-message preview, and an unread badge that tints when > 0.
//   • Pinned chats bubble to the top (server-sorted, we just render).
//   • Swipe-left  → Archive
//     Swipe-right → Pin / Mute action pair
//   • Pull-to-refresh, search users (debounced), suggested users empty-state.
//   • Realtime hooks — chatUpdated / userOnline / userOffline stay in place.
//
// Perf: FlatList with getItemLayout when possible; ChatRow is React.memo'd
// with a shallow-compare that only re-renders on the fields it actually
// reads. Suits inboxes with hundreds of chats.

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, TextInput, StyleSheet,
  ActivityIndicator, Keyboard, StatusBar, Alert, RefreshControl, Animated,
} from 'react-native';
import { GestureHandlerRootView, Swipeable, RectButton } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import chatService   from '../services/ChatService';
import socketService from '../services/SocketService';

// ─── Helpers ────────────────────────────────────────────────────────────────

const timeAgo = (date) => {
  if (!date) return '';
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60)     return 'now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getInitials = (name) => (name || '?')
  .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const previewText = (chat) => {
  const t = chat.lastMessage?.type;
  const raw = chat.lastMessage?.text;
  if (!t || t === 'text') return raw || 'Tap to start chatting';
  return raw || '';
};

// Consistent light haptic — chat rows use Selection to feel snappy, actions
// use Light on release.
const bump = (kind = 'Selection') => {
  try {
    if (kind === 'Selection') Haptics.selectionAsync();
    else                       Haptics.impactAsync(Haptics.ImpactFeedbackStyle[kind] || Haptics.ImpactFeedbackStyle.Light);
  } catch (_) { /* haptics may be unavailable */ }
};

// ─── Swipe action buttons ───────────────────────────────────────────────────

const SwipeAction = ({ bg, icon, label, onPress, textColor = '#fff', width = 82 }) => (
  <RectButton style={[SA.btn, { backgroundColor: bg, width }]} onPress={onPress}>
    <Ionicons name={icon} size={22} color={textColor} />
    <Text style={[SA.label, { color: textColor }]}>{label}</Text>
  </RectButton>
);

const SA = StyleSheet.create({
  btn:   { justifyContent: 'center', alignItems: 'center', height: '100%' },
  label: { fontSize: 11, marginTop: 4, fontWeight: '600' },
});

// ─── Chat row (memoised) ────────────────────────────────────────────────────
//
// Ref forwarded to the Swipeable so we can programmatically close after an
// action completes — keeps the row from staying open with a dead action bar.

const ChatRow = memo(function ChatRow({
  item, online, colors, onOpen, onPin, onMute, onArchive, onDelete,
}) {
  const u = item.otherUser || {};
  const unread   = item.unreadCount || 0;
  const isGroup  = item.type === 'group';
  const title    = isGroup ? (item.groupName || 'Group') : (u.username || 'user');
  const avatar   = isGroup ? item.groupImage : u.profileImage;
  const verified = !isGroup && u.isVerified;
  const swipeRef = useRef(null);

  const close = () => swipeRef.current?.close();

  // Right actions (revealed on swipe-left): Archive + Delete.
  // Delete for a 1-on-1 chat is effectively "clear my history" — we don't
  // delete the chat doc, we just clear it for the current user.
  const renderRight = () => (
    <View style={{ flexDirection: 'row', height: '100%' }}>
      <SwipeAction
        bg={colors.accent || '#0EA5E9'}
        icon="archive-outline"
        label={item.isArchived ? 'Unarchive' : 'Archive'}
        onPress={() => { bump('Light'); onArchive(item); close(); }}
      />
      <SwipeAction
        bg="#EF4444"
        icon="trash-outline"
        label="Clear"
        onPress={() => { bump('Medium'); onDelete(item); close(); }}
      />
    </View>
  );

  // Left actions (revealed on swipe-right): Pin + Mute.
  const renderLeft = () => (
    <View style={{ flexDirection: 'row', height: '100%' }}>
      <SwipeAction
        bg="#22C55E"
        icon={item.isPinned ? 'pin' : 'pin-outline'}
        label={item.isPinned ? 'Unpin' : 'Pin'}
        onPress={() => { bump('Light'); onPin(item); close(); }}
      />
      <SwipeAction
        bg="#F59E0B"
        icon={item.isMuted ? 'notifications' : 'notifications-off-outline'}
        label={item.isMuted ? 'Unmute' : 'Mute'}
        onPress={() => { bump('Light'); onMute(item); close(); }}
      />
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRight}
      renderLeftActions={renderLeft}
      overshootFriction={8}
      friction={2}
    >
      <TouchableOpacity
        style={[S.chatRow, { backgroundColor: colors.bg }]}
        activeOpacity={0.85}
        onPress={() => onOpen(item)}
      >
        <View style={S.avatarWrap}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={S.avatar} />
          ) : (
            <View style={[S.avatar, S.avatarFallback]}>
              <Text style={S.avatarInitials}>{getInitials(isGroup ? item.groupName : u.fullName || u.username)}</Text>
            </View>
          )}
          {online && !isGroup && (
            <View style={[S.onlineDot, { borderColor: colors.bg }]} />
          )}
        </View>

        <View style={S.chatContent}>
          <View style={S.chatHeader}>
            <View style={S.nameRow}>
              <Text
                style={[
                  S.username,
                  { color: colors.text },
                  unread > 0 && S.usernameUnread,
                ]}
                numberOfLines={1}
              >
                {title}
              </Text>
              {verified && (
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={14}
                  color="#3B82F6"
                  style={{ marginLeft: 4 }}
                />
              )}
              {item.isPinned && (
                <Ionicons name="pin" size={13} color={colors.textDim} style={{ marginLeft: 6, transform: [{ rotate: '45deg' }] }} />
              )}
              {item.isMuted && (
                <Ionicons name="notifications-off" size={13} color={colors.textDim} style={{ marginLeft: 6 }} />
              )}
            </View>
            <Text style={[S.time, { color: unread > 0 ? (colors.accent || '#3B82F6') : colors.textDim }]}>
              {timeAgo(item.lastMessage?.createdAt || item.updatedAt)}
            </Text>
          </View>

          <View style={S.previewRow}>
            <Text
              style={[
                S.lastMsg,
                { color: colors.textMuted },
                unread > 0 && { color: colors.text, fontWeight: '600' },
              ]}
              numberOfLines={1}
            >
              {previewText(item)}
            </Text>
            {unread > 0 && (
              <View style={[S.badge, { backgroundColor: colors.accent || '#3B82F6' }]}>
                <Text style={S.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}, (prev, next) =>
  prev.online === next.online
  && prev.item._id === next.item._id
  && prev.item.unreadCount === next.item.unreadCount
  && prev.item.isPinned === next.item.isPinned
  && prev.item.isMuted === next.item.isMuted
  && prev.item.isArchived === next.item.isArchived
  && prev.item.updatedAt === next.item.updatedAt
  && prev.item.lastMessage?.createdAt === next.item.lastMessage?.createdAt
);

const SearchRow = memo(function SearchRow({ user, onPress, colors }) {
  return (
    <TouchableOpacity style={[S.chatRow, { backgroundColor: colors.bg }]} activeOpacity={0.7} onPress={onPress}>
      <View style={S.avatarWrap}>
        {user.profileImage ? (
          <Image source={{ uri: user.profileImage }} style={S.avatar} />
        ) : (
          <View style={[S.avatar, S.avatarFallback]}>
            <Text style={S.avatarInitials}>{getInitials(user.fullName || user.username)}</Text>
          </View>
        )}
      </View>
      <View style={S.chatContent}>
        <Text style={[S.username, { color: colors.text }]}>{user.username}</Text>
        <Text style={[S.lastMsg, { color: colors.textMuted }]} numberOfLines={1}>{user.fullName}</Text>
      </View>
    </TouchableOpacity>
  );
});

// ─── Skeleton row (loading state) ───────────────────────────────────────────
// Simple shimmer using a looping Animated.Value on opacity.
function SkeletonRow({ colors }) {
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1,   duration: 800, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.5, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View style={[S.chatRow, { opacity: v }]}>
      <View style={[S.avatar, { backgroundColor: colors.iconChipBg }]} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={[S.skelLine, { width: '55%', backgroundColor: colors.iconChipBg }]} />
        <View style={[S.skelLine, { width: '80%', marginTop: 8, backgroundColor: colors.iconChipBg, height: 10 }]} />
      </View>
    </Animated.View>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const insets       = useSafeAreaInsets();
  const { colors }   = useTheme();
  const navigation   = useNavigation();
  const { user }     = useAuth(); // eslint-disable-line no-unused-vars

  const [chats,          setChats]         = useState([]);
  const [archivedChats,  setArchivedChats] = useState([]);
  const [showArchived,   setShowArchived]  = useState(false);
  const [loading,        setLoading]       = useState(true);
  const [refreshing,     setRefreshing]    = useState(false);
  const [searchQuery,    setSearchQuery]   = useState('');
  const [searchResults,  setSearchResults] = useState([]);
  const [searching,      setSearching]     = useState(false);
  const [onlineUsers,    setOnlineUsers]   = useState(new Set());
  const [suggested,      setSuggested]     = useState([]);

  const searchTimer = useRef(null);

  // ── Load chats ──────────────────────────────────────────────────────────
  const loadChats = useCallback(async () => {
    const res = await chatService.getMyChats();
    if (res.success) {
      setChats(res.chats || []);
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        (res.chats || []).forEach((c) => {
          const id = c.otherUser?._id;
          if (id && c.otherUser?.isOnline) next.add(id);
        });
        return next;
      });
    }
    setLoading(false);
  }, []);

  const loadArchived = useCallback(async () => {
    const res = await chatService.getMyChats({ archived: true });
    if (res.success) setArchivedChats(res.chats || []);
  }, []);

  const loadSuggested = useCallback(async () => {
    const res = await chatService.searchUsers('');
    if (res?.success && Array.isArray(res.users)) setSuggested(res.users);
  }, []);

  useFocusEffect(useCallback(() => {
    loadChats();
    loadSuggested();
  }, [loadChats, loadSuggested]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadChats(), showArchived ? loadArchived() : Promise.resolve()]);
    setRefreshing(false);
  }, [loadChats, loadArchived, showArchived]);

  // ── Socket listeners ────────────────────────────────────────────────────
  useEffect(() => {
    socketService.connect();
    const unsubs = [
      socketService.on('chatUpdated', ({ chatId, lastMessage, unreadCount }) => {
        setChats((prev) => {
          const idx = prev.findIndex(c => c._id === chatId);
          if (idx === -1) { loadChats(); return prev; }
          const updated = [...prev];
          updated[idx] = { ...updated[idx], lastMessage, unreadCount, updatedAt: lastMessage.createdAt };
          // Re-sort: pinned first, then by activity.
          updated.sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
          });
          return updated;
        });
      }),
      socketService.on('userOnline',  ({ userId }) => setOnlineUsers(p => new Set(p).add(userId))),
      socketService.on('userOffline', ({ userId }) => setOnlineUsers(p => { const n = new Set(p); n.delete(userId); return n; })),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [loadChats]);

  // ── Search (debounced 300 ms) ────────────────────────────────────────────
  const handleSearch = (text) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const res = await chatService.searchUsers(text.trim());
      setSearchResults(res.users || []);
      setSearching(false);
    }, 300);
  };

  // ── Row actions ─────────────────────────────────────────────────────────
  const openChat = useCallback((chat) => {
    Keyboard.dismiss();
    setSearchQuery(''); setSearchResults([]);
    navigation.navigate('ChatConversation', {
      chatId:    chat._id,
      otherUser: chat.otherUser,
    });
  }, [navigation]);

  const openChatWithUser = useCallback(async (otherUser) => {
    Keyboard.dismiss();
    setSearchQuery(''); setSearchResults([]);
    const res = await chatService.createOrGetChat(otherUser._id);
    if (res.success) {
      navigation.navigate('ChatConversation', {
        chatId: res.chat._id,
        otherUser: res.chat.otherUser,
      });
    }
  }, [navigation]);

  const optimisticPatch = (id, patch) =>
    setChats(prev => prev.map(c => c._id === id ? { ...c, ...patch } : c));

  const onPin = useCallback(async (chat) => {
    optimisticPatch(chat._id, { isPinned: !chat.isPinned });
    const res = await chatService.togglePinChat(chat._id);
    if (!res?.success) optimisticPatch(chat._id, { isPinned: chat.isPinned });
  }, []);

  const onMute = useCallback(async (chat) => {
    optimisticPatch(chat._id, { isMuted: !chat.isMuted });
    const res = await chatService.toggleMuteChat(chat._id);
    if (!res?.success) optimisticPatch(chat._id, { isMuted: chat.isMuted });
  }, []);

  const onArchive = useCallback(async (chat) => {
    // Optimistically remove from the visible list.
    setChats(prev => prev.filter(c => c._id !== chat._id));
    const res = await chatService.toggleArchive(chat._id);
    if (!res?.success) loadChats();
  }, [loadChats]);

  const onDelete = useCallback((chat) => {
    Alert.alert(
      'Clear this chat?',
      'Messages will be removed from your view. The other participant will still see them.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear',  style: 'destructive', onPress: async () => {
          setChats(prev => prev.filter(c => c._id !== chat._id));
          const res = await chatService.clearChatHistory(chat._id);
          if (!res?.success) loadChats();
        }},
      ],
    );
  }, [loadChats]);

  // ── Render helpers ──────────────────────────────────────────────────────
  const isSearching = searchQuery.trim().length > 0;
  const list = showArchived ? archivedChats : chats;

  const renderChatItem = ({ item }) => (
    <ChatRow
      item={item}
      colors={colors}
      online={onlineUsers.has(item.otherUser?._id)}
      onOpen={openChat}
      onPin={onPin}
      onMute={onMute}
      onArchive={onArchive}
      onDelete={onDelete}
    />
  );

  const renderSearchItem = ({ item }) => (
    <SearchRow user={item} colors={colors} onPress={() => openChatWithUser(item)} />
  );

  const listHeader = (
    <View style={S.headerBlock}>
      {/* Archived toggle — shown only when there's something archived. */}
      {(archivedChats.length > 0 || showArchived) && (
        <TouchableOpacity
          style={[S.archivedBtn, { backgroundColor: colors.iconChipBg }]}
          onPress={async () => {
            setShowArchived(v => !v);
            if (!showArchived) await loadArchived();
          }}
        >
          <Ionicons name="archive-outline" size={20} color={colors.text} />
          <Text style={[S.archivedTxt, { color: colors.text }]}>
            {showArchived ? 'Back to Chats' : `Archived (${archivedChats.length || '…'})`}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[S.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
        <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />

        {/* Header */}
        <View style={[S.header, { borderBottomColor: colors.divider }]}>
          <Text style={[S.headerTitle, { color: colors.text }]}>
            {showArchived ? 'Archived' : 'Messages'}
          </Text>
          <TouchableOpacity style={S.newBtn} onPress={() => {/* future: new chat modal */}}>
            <Ionicons name="create-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={[S.searchWrap, { backgroundColor: colors.iconChipBg }]}>
          <Ionicons name="search" size={18} color={colors.textDim} style={{ marginRight: 8 }} />
          <TextInput
            style={[S.searchInput, { color: colors.text }]}
            placeholder="Search users..."
            placeholderTextColor={colors.textDim}
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textDim} />
            </TouchableOpacity>
          )}
        </View>

        {/* Body */}
        {isSearching ? (
          searching ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item._id}
              renderItem={renderSearchItem}
              contentContainerStyle={{ paddingBottom: 120 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={S.empty}>
                  <Ionicons name="person-outline" size={48} color={colors.textDim} />
                  <Text style={[S.emptyText, { color: colors.textMuted }]}>No users found</Text>
                </View>
              }
            />
          )
        ) : loading ? (
          <FlatList
            data={[0, 1, 2, 3, 4, 5]}
            keyExtractor={(i) => `sk-${i}`}
            renderItem={() => <SkeletonRow colors={colors} />}
          />
        ) : list.length === 0 && !showArchived ? (
          <FlatList
            data={suggested}
            keyExtractor={(item) => item._id}
            renderItem={renderSearchItem}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
            ListHeaderComponent={
              <View style={S.empty}>
                <Ionicons name="chatbubbles-outline" size={56} color={colors.textDim} />
                <Text style={[S.emptyTitle, { color: colors.text }]}>No messages yet</Text>
                <Text style={[S.emptyText, { color: colors.textMuted }]}>
                  Tap anyone below to start a conversation
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={S.empty}>
                <Ionicons name="person-outline" size={48} color={colors.textDim} />
                <Text style={[S.emptyText, { color: colors.textMuted, marginTop: 14 }]}>
                  No other users are signed up yet.
                </Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={list}
            keyExtractor={(item) => item._id}
            renderItem={renderChatItem}
            ListHeaderComponent={listHeader}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            maxToRenderPerBatch={16}
            windowSize={11}
            removeClippedSubviews
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
            ItemSeparatorComponent={() => <View style={[S.separator, { backgroundColor: colors.divider }]} />}
            ListEmptyComponent={
              <View style={S.empty}>
                <Ionicons name="archive-outline" size={48} color={colors.textDim} />
                <Text style={[S.emptyText, { color: colors.textMuted, marginTop: 14 }]}>
                  Nothing here.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle:     { fontSize: 22, fontWeight: '800' },
  newBtn:          { padding: 4 },

  searchWrap:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:     { flex: 1, fontSize: 15, padding: 0 },

  headerBlock:     { paddingHorizontal: 0 },
  archivedBtn:     { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  archivedTxt:     { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600' },

  chatRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  avatarWrap:      { position: 'relative', marginRight: 12 },
  avatar:          { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e2e8f0' },
  avatarFallback:  { alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6' },
  avatarInitials:  { color: '#fff', fontWeight: '800', fontSize: 18 },
  onlineDot:       { position: 'absolute', bottom: 1, right: 1, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22c55e', borderWidth: 2.5, borderColor: '#fff' },

  chatContent:     { flex: 1 },
  chatHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nameRow:         { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  username:        { fontSize: 15, fontWeight: '600' },
  usernameUnread:  { fontWeight: '800' },
  time:            { fontSize: 12 },

  previewRow:      { flexDirection: 'row', alignItems: 'center' },
  lastMsg:         { fontSize: 14, flex: 1 },
  badge:           { marginLeft: 8, borderRadius: 12, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText:       { color: '#fff', fontSize: 11, fontWeight: '800' },

  separator:       { height: 1, marginLeft: 80 },

  empty:           { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle:      { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyText:       { fontSize: 14, marginTop: 6 },

  skelLine:        { height: 14, borderRadius: 6 },
});
