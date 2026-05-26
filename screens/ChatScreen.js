// truevision/screens/ChatScreen.js  — Chat Inbox (DM list + user search)
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, TextInput,
  StyleSheet, ActivityIndicator, Keyboard, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import chatService   from '../services/ChatService';
import socketService from '../services/SocketService';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const timeAgo = (date) => {
  if (!date) return '';
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60)    return 'now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

// ─────────────────────────────────────────────────────────────────────────────
// Chat Row
// ─────────────────────────────────────────────────────────────────────────────

const ChatRow = ({ item, onPress, online, colors }) => {
  const u = item.otherUser || {};
  const unread = item.unreadCount || 0;

  return (
    <TouchableOpacity style={S.chatRow} activeOpacity={0.7} onPress={onPress}>
      <View style={S.avatarWrap}>
        {u.profileImage ? (
          <Image source={{ uri: u.profileImage }} style={S.avatar} />
        ) : (
          <View style={[S.avatar, S.avatarFallback]}>
            <Text style={S.avatarInitials}>{getInitials(u.fullName)}</Text>
          </View>
        )}
        {online && <View style={[S.onlineDot, { borderColor: colors.bg }]} />}
        {unread > 0 && (
          <View style={[S.badge, { borderColor: colors.bg }]}>
            <Text style={S.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </View>

      <View style={S.chatContent}>
        <View style={S.chatHeader}>
          <Text
            style={[S.username, { color: colors.text }, unread > 0 && S.usernameUnread]}
            numberOfLines={1}
          >
            {u.username || 'user'}
          </Text>
          <Text style={[S.time, { color: colors.textDim }]}>
            {timeAgo(item.lastMessage?.createdAt || item.updatedAt)}
          </Text>
        </View>
        <Text
          style={[
            S.lastMsg,
            { color: colors.textMuted },
            unread > 0 && { color: colors.text, fontWeight: '600' },
          ]}
          numberOfLines={1}
        >
          {item.lastMessage?.text || 'Tap to start chatting'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Search Result Row
// ─────────────────────────────────────────────────────────────────────────────

const SearchRow = ({ user, onPress, colors }) => (
  <TouchableOpacity style={S.chatRow} activeOpacity={0.7} onPress={onPress}>
    <View style={S.avatarWrap}>
      {user.profileImage ? (
        <Image source={{ uri: user.profileImage }} style={S.avatar} />
      ) : (
        <View style={[S.avatar, S.avatarFallback]}>
          <Text style={S.avatarInitials}>{getInitials(user.fullName)}</Text>
        </View>
      )}
    </View>
    <View style={S.chatContent}>
      <Text style={[S.username, { color: colors.text }]}>{user.username}</Text>
      <Text style={[S.lastMsg, { color: colors.textMuted }]} numberOfLines={1}>{user.fullName}</Text>
    </View>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const insets     = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { user }   = useAuth();

  const [chats, setChats]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // Suggested users — shown in the empty state so a brand-new user can
  // tap someone and start a conversation without typing in the search box.
  // Backend returns up to 30 recently-active users when `q` is empty.
  const [suggested, setSuggested] = useState([]);

  const searchTimer = useRef(null);

  // ── Load chats on focus ──────────────────────────────────────────────────
  const loadChats = useCallback(async () => {
    const res = await chatService.getMyChats();
    if (res.success) {
      setChats(res.chats);
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        res.chats.forEach((c) => {
          const id = c.otherUser?._id;
          if (id && c.otherUser?.isOnline) next.add(id);
        });
        return next;
      });
    }
    setLoading(false);
  }, []);

  // ── Load suggested users (people-you-can-chat-with) ─────────────────────
  // Fires on focus so the list stays fresh as new users register.
  const loadSuggested = useCallback(async () => {
    const res = await chatService.searchUsers('');
    if (res?.success && Array.isArray(res.users)) {
      setSuggested(res.users);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadChats();
      loadSuggested();
    }, [loadChats, loadSuggested]),
  );

  // ── Socket listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    socketService.connect();

    const unsubs = [
      socketService.on('chatUpdated', ({ chatId, lastMessage, unreadCount }) => {
        setChats((prev) => {
          const idx = prev.findIndex(c => c._id === chatId);
          if (idx === -1) {
            // New chat — reload full list
            loadChats();
            return prev;
          }
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            lastMessage,
            unreadCount,
            updatedAt: lastMessage.createdAt,
          };
          // Re-sort by most recent
          updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          return updated;
        });
      }),

      socketService.on('userOnline', ({ userId }) => {
        setOnlineUsers((prev) => new Set(prev).add(userId));
      }),

      socketService.on('userOffline', ({ userId }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }),
    ];

    return () => unsubs.forEach(fn => fn());
  }, [loadChats]);

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = (text) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (text.trim().length < 1) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const res = await chatService.searchUsers(text.trim());
      setSearchResults(res.users || []);
      setSearching(false);
    }, 300);
  };

  // ── Open conversation ─────────────────────────────────────────────────────
  const openChat = (chatId, otherUser) => {
    Keyboard.dismiss();
    setSearchQuery('');
    setSearchResults([]);
    navigation.navigate('ChatConversation', { chatId, otherUser });
  };

  const openChatWithUser = async (otherUser) => {
    Keyboard.dismiss();
    setSearchQuery('');
    setSearchResults([]);
    const res = await chatService.createOrGetChat(otherUser._id);
    if (res.success) {
      navigation.navigate('ChatConversation', {
        chatId: res.chat._id,
        otherUser: res.chat.otherUser,
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const isSearching = searchQuery.trim().length > 0;

  return (
    <View style={[S.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />

      {/* Header */}
      <View style={[S.header, { borderBottomColor: colors.divider }]}>
        <Text style={[S.headerTitle, { color: colors.text }]}>Messages</Text>
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

      {/* Search results */}
      {isSearching ? (
        searching ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <SearchRow user={item} colors={colors} onPress={() => openChatWithUser(item)} />
            )}
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={
              <View style={S.empty}>
                <Ionicons name="person-outline" size={48} color={colors.textDim} />
                <Text style={[S.emptyText, { color: colors.textMuted }]}>No users found</Text>
              </View>
            }
          />
        )
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={colors.accent} />
      ) : chats.length === 0 ? (
        /* No chats yet — show suggested users so the user can tap one and start.
           SearchRow is the same component used by the search results list, so
           the row visuals stay consistent. */
        <FlatList
          data={suggested}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <SearchRow user={item} colors={colors} onPress={() => openChatWithUser(item)} />
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
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
        /* Chat list */
        <FlatList
          data={chats}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <ChatRow
              item={item}
              colors={colors}
              online={onlineUsers.has(item.otherUser?._id)}
              onPress={() => openChat(item._id, item.otherUser)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={[S.separator, { backgroundColor: colors.divider }]} />}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container:       { flex: 1 }, // backgroundColor injected from theme at runtime
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle:     { fontSize: 22, fontWeight: '800', color: '#111827' },
  newBtn:          { padding: 4 },

  searchWrap:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 10, backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:     { flex: 1, fontSize: 15, color: '#111827', padding: 0 },

  chatRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  avatarWrap:      { position: 'relative', marginRight: 12 },
  avatar:          { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e2e8f0' },
  avatarFallback:  { alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6' },
  avatarInitials:  { color: '#fff', fontWeight: '800', fontSize: 18 },

  onlineDot:       { position: 'absolute', bottom: 1, right: 1, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22c55e', borderWidth: 2.5, borderColor: '#fff' },
  badge:           { position: 'absolute', top: -2, right: -4, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white', paddingHorizontal: 4 },
  badgeText:       { color: 'white', fontSize: 10, fontWeight: '800' },

  chatContent:     { flex: 1 },
  chatHeader:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  username:        { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  usernameUnread:  { fontWeight: '800' },
  time:            { fontSize: 12, color: '#94a3b8' },
  lastMsg:         { fontSize: 14, color: '#6b7280' },
  lastMsgUnread:   { color: '#111827', fontWeight: '600' },

  separator:       { height: 1, backgroundColor: '#f8fafc', marginLeft: 80 },

  empty:           { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle:      { color: '#374151', fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyText:       { color: '#94a3b8', fontSize: 14, marginTop: 6 },
});
