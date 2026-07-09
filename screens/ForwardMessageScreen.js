// truevision/screens/ForwardMessageScreen.js
//
// Dedicated screen to forward one or more messages to one or more chats.
//
// Backend contract (already exists):
//   POST /api/chats/forward   { messageIds: [...], toChatIds: [...] }
// This screen is a pure UI over that endpoint — it picks the target chat
// ids (optionally after creating new 1-on-1 chats from a picked user) and
// fires the single POST. Original sender info is preserved server-side
// via `forwardedFrom`; the receiving bubbles show a "Forwarded" tag.
//
// Layout mirrors WhatsApp:
//   ┌─────────────────────────────────────┐
//   │  [<] Forward to     [Send N ▶]     │  ← header
//   │  🔍 Search users or chats           │  ← search bar
//   │  Selected: [alice ×] [group ×] …    │  ← chips row (only when > 0)
//   │  Recent Chats                       │
//   │  ────────────────────────────       │
//   │  ● alice        (verified)   [ ]    │
//   │  ● design team  (5 members)  [x]    │
//   │  …                                  │
//   │  Frequently Contacted               │
//   │  ────────────────────────────       │
//   │  ● bob        [ ]                   │
//   │  …                                  │
//   └─────────────────────────────────────┘
//
// The confirmation happens via a floating "Send" button that turns on when
// at least one row is selected. A spinner overlay appears during the POST
// so the user gets clear feedback.

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, TextInput, StyleSheet,
  ActivityIndicator, Alert, Platform, StatusBar, Animated, Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import chatService from '../services/ChatService';

// ─── Helpers ─────────────────────────────────────────────────────────────
const initials = (n) => (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const previewText = (chat) => {
  const t = chat.lastMessage?.type;
  const raw = chat.lastMessage?.text;
  if (!t || t === 'text') return raw || '';
  return raw || '';
};

// Reuse the same dark-glass palette as ChatConversationScreen so the two
// screens feel like a single flow.
const palette = (isDark) => isDark ? {
  bg:        '#050505',
  bgGrad:    ['#050505', '#0A0A0A', '#050505'],
  glow:      '59,130,246',
  glassTint: 'dark',
  headerBg:  'rgba(10,10,10,0.55)',
  surface:   'rgba(255,255,255,0.05)',
  border:    'rgba(255,255,255,0.08)',
  primary:   '#FFFFFF',
  secondary: 'rgba(255,255,255,0.65)',
  dim:       'rgba(255,255,255,0.40)',
  inputBg:   'rgba(255,255,255,0.06)',
  accent:    '#3B82F6',
  accentGrad:['#3B82F6', '#2563EB'],
  online:    '#22C55E',
  chipBg:    'rgba(59,130,246,0.18)',
  chipBd:    'rgba(59,130,246,0.55)',
  danger:    '#EF4444',
  statusBar: 'light-content',
} : {
  bg:        '#FFFFFF',
  bgGrad:    ['#FFFFFF', '#F4F7FB', '#FFFFFF'],
  glow:      '59,130,246',
  glassTint: 'light',
  headerBg:  'rgba(255,255,255,0.6)',
  surface:   'rgba(15,23,42,0.04)',
  border:    'rgba(15,23,42,0.08)',
  primary:   '#0F172A',
  secondary: '#64748B',
  dim:       '#94A3B8',
  inputBg:   'rgba(15,23,42,0.05)',
  accent:    '#3B82F6',
  accentGrad:['#3B82F6', '#2563EB'],
  online:    '#22C55E',
  chipBg:    'rgba(59,130,246,0.12)',
  chipBd:    'rgba(59,130,246,0.35)',
  danger:    '#EF4444',
  statusBar: 'dark-content',
};

// ─── Row ────────────────────────────────────────────────────────────────
// One selectable row — memoised because a busy list of hundreds of contacts
// would otherwise reflow every time the parent re-renders (e.g. typing in
// the search bar).
const TargetRow = memo(function TargetRow({ item, selected, onToggle, ct, kind }) {
  // `kind` = 'chat' (item is a chat with .otherUser / .groupName)
  //        = 'user' (item is a raw user)
  const isGroup = kind === 'chat' && item.type === 'group';
  const other   = kind === 'chat' ? item.otherUser : item;
  const title   = isGroup ? (item.groupName || 'Group') : (other?.username || other?.fullName || 'user');
  const avatar  = isGroup ? item.groupImage : other?.profileImage;
  const verified = !isGroup && other?.isVerified;
  const subtitle = kind === 'chat'
    ? (isGroup ? `${item.members?.length || 2} members` : previewText(item))
    : (other?.fullName || '');

  return (
    <TouchableOpacity
      style={[R.row, selected && { backgroundColor: ct.chipBg }]}
      activeOpacity={0.8}
      onPress={() => onToggle(item, kind)}
    >
      <View style={R.avatarWrap}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={R.avatar} />
        ) : (
          <LinearGradient colors={ct.accentGrad} style={[R.avatar, R.avatarFallback]}>
            <Text style={R.avatarInitials}>{initials(isGroup ? item.groupName : (other?.fullName || other?.username))}</Text>
          </LinearGradient>
        )}
      </View>
      <View style={R.body}>
        <View style={R.titleRow}>
          <Text style={[R.title, { color: ct.primary }]} numberOfLines={1}>{title}</Text>
          {verified && <MaterialCommunityIcons name="check-decagram" size={14} color={ct.accent} style={{ marginLeft: 4 }} />}
        </View>
        {!!subtitle && <Text style={[R.subtitle, { color: ct.secondary }]} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {/* Checkbox — filled if selected, outline otherwise. */}
      <View style={[R.check, {
        borderColor: selected ? ct.accent : ct.border,
        backgroundColor: selected ? ct.accent : 'transparent',
      }]}>
        {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}, (prev, next) => (
  prev.selected === next.selected
  && prev.item._id === next.item._id
  && prev.item.updatedAt === next.item.updatedAt
));

// ─── Screen ─────────────────────────────────────────────────────────────
export default function ForwardMessageScreen({ route, navigation }) {
  const { messageIds = [], fromChatId } = route.params || {};
  const { isDark } = useTheme();
  const ct        = palette(isDark);
  const insets    = useSafeAreaInsets();

  const [query, setQuery]                   = useState('');
  const [chats, setChats]                   = useState([]);   // recent chats
  const [users, setUsers]                   = useState([]);   // frequent / suggested
  const [searchResults, setSearchResults]   = useState([]);   // user search hits
  const [loading, setLoading]               = useState(true);
  const [searching, setSearching]           = useState(false);
  const [forwarding, setForwarding]         = useState(false);

  // Selection stored as two dictionaries keyed by id so lookups are O(1)
  // during row-render.  We keep chats and users separate because a picked
  // user must be converted to a chat id right before the forward POST.
  const [selectedChats, setSelectedChats]   = useState({});   // chatId → chat
  const [selectedUsers, setSelectedUsers]   = useState({});   // userId → user

  const searchTimer = useRef(null);
  const successOp   = useRef(new Animated.Value(0)).current;   // success overlay opacity

  // ── Load recent chats + suggested users ───────────────────────────────
  useEffect(() => {
    (async () => {
      const [chatsRes, usersRes] = await Promise.all([
        chatService.getMyChats(),
        chatService.searchUsers(''),  // '' returns recent/active users
      ]);
      const rawChats = chatsRes?.success ? (chatsRes.chats || []) : [];
      // Don't include the origin chat as a target — users rarely want to
      // forward back into the same conversation.
      setChats(rawChats.filter(c => c._id !== fromChatId));
      setUsers(usersRes?.success ? (usersRes.users || []) : []);
      setLoading(false);
    })();
  }, [fromChatId]);

  // ── Live search — user search endpoint, 300 ms debounce ───────────────
  const runSearch = useCallback((q) => {
    if (!q.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const res = await chatService.searchUsers(q.trim());
      setSearchResults(res?.users || []);
      setSearching(false);
    }, 300);
  }, []);

  useEffect(() => { runSearch(query); }, [query, runSearch]);

  // ── Selection toggle ─────────────────────────────────────────────────
  const toggle = useCallback((item, kind) => {
    Haptics.selectionAsync().catch(() => {});
    if (kind === 'chat') {
      setSelectedChats(prev => {
        const next = { ...prev };
        if (next[item._id]) delete next[item._id];
        else                next[item._id] = item;
        return next;
      });
    } else {
      setSelectedUsers(prev => {
        const next = { ...prev };
        if (next[item._id]) delete next[item._id];
        else                next[item._id] = item;
        return next;
      });
    }
  }, []);

  const selectedCount = Object.keys(selectedChats).length + Object.keys(selectedUsers).length;

  // Filtered lists depending on whether there's a query. Chats are filtered
  // locally by their title (fast, no network); users use the search endpoint.
  const filteredChats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(c => {
      const title = c.type === 'group' ? c.groupName : (c.otherUser?.username || c.otherUser?.fullName);
      return (title || '').toLowerCase().includes(q);
    });
  }, [chats, query]);

  // ── Perform forward ──────────────────────────────────────────────────
  const doForward = useCallback(async () => {
    if (!selectedCount || forwarding) return;
    setForwarding(true);

    try {
      // Convert selected users to chat ids by creating (or re-using) 1-on-1 chats.
      const userChatIds = [];
      for (const uid of Object.keys(selectedUsers)) {
        const res = await chatService.createOrGetChat(uid);
        if (res?.success && res.chat?._id) userChatIds.push(res.chat._id);
      }
      const toChatIds = [...Object.keys(selectedChats), ...userChatIds];
      if (!toChatIds.length) { setForwarding(false); return; }

      const res = await chatService.forwardMessages({ messageIds, toChatIds });
      if (!res?.success) {
        setForwarding(false);
        return Alert.alert('Forward failed', res?.message || 'Please try again.');
      }

      // Success flash then navigate back.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.sequence([
        Animated.timing(successOp, { toValue: 1, duration: 180, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.delay(600),
        Animated.timing(successOp, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setForwarding(false);
        navigation.goBack();
      });
    } catch (err) {
      setForwarding(false);
      Alert.alert('Error', err.message);
    }
  }, [selectedCount, forwarding, selectedUsers, selectedChats, messageIds, navigation, successOp]);

  // ── Chips row of picked targets ──────────────────────────────────────
  const chips = [
    ...Object.values(selectedChats).map(c => ({
      key: c._id,
      label: c.type === 'group' ? (c.groupName || 'Group') : (c.otherUser?.username || 'user'),
      onRemove: () => toggle(c, 'chat'),
    })),
    ...Object.values(selectedUsers).map(u => ({
      key: u._id,
      label: u.username || u.fullName,
      onRemove: () => toggle(u, 'user'),
    })),
  ];

  // ── FlatList data assembly (single scroll, section-style) ────────────
  // We flatten section headers into the data so a single VirtualizedList
  // handles everything — better than two nested lists.
  const listData = useMemo(() => {
    const rows = [];
    if (query.trim()) {
      // Search mode: show user results only.
      rows.push({ _id: '__h_users_search', kind: 'header', label: 'People' });
      searchResults.forEach(u => rows.push({ ...u, kind: 'user' }));
      return rows;
    }
    if (filteredChats.length) {
      rows.push({ _id: '__h_chats', kind: 'header', label: 'Recent Chats' });
      filteredChats.forEach(c => rows.push({ ...c, kind: 'chat' }));
    }
    if (users.length) {
      rows.push({ _id: '__h_users', kind: 'header', label: 'Frequently Contacted' });
      users.forEach(u => rows.push({ ...u, kind: 'user' }));
    }
    return rows;
  }, [query, searchResults, filteredChats, users]);

  const renderItem = ({ item }) => {
    if (item.kind === 'header') {
      return <Text style={[F.sectionHead, { color: ct.secondary }]}>{item.label}</Text>;
    }
    const selected = item.kind === 'chat' ? !!selectedChats[item._id] : !!selectedUsers[item._id];
    return (
      <TargetRow
        item={item}
        selected={selected}
        kind={item.kind}
        onToggle={toggle}
        ct={ct}
      />
    );
  };

  return (
    <View style={[F.shell, { backgroundColor: ct.bg }]}>
      <LinearGradient colors={ct.bgGrad} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={F.glowWrap}>
        <View style={[F.glow, { width: 420, height: 420, borderRadius: 210, backgroundColor: `rgba(${ct.glow},0.06)` }]} />
        <View style={[F.glow, { width: 280, height: 280, borderRadius: 140, backgroundColor: `rgba(${ct.glow},0.09)` }]} />
      </View>

      <StatusBar barStyle={ct.statusBar} backgroundColor="transparent" translucent />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Header */}
        <BlurView intensity={isDark ? 40 : 60} tint={ct.glassTint}
          style={[F.header, { backgroundColor: ct.headerBg, borderBottomColor: ct.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={F.headerBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color={ct.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[F.headerTitle, { color: ct.primary }]}>Forward to…</Text>
            <Text style={[F.headerSub, { color: ct.secondary }]}>
              {messageIds.length} {messageIds.length === 1 ? 'message' : 'messages'}
              {selectedCount ? ` · ${selectedCount} selected` : ''}
            </Text>
          </View>
          {selectedCount > 0 && (
            <TouchableOpacity onPress={doForward} disabled={forwarding} style={F.sendBtn}>
              <LinearGradient colors={ct.accentGrad} style={F.sendGrad}>
                {forwarding
                  ? <ActivityIndicator size={16} color="#fff" />
                  : <>
                      <Ionicons name="send" size={16} color="#fff" />
                      <Text style={F.sendTxt}>Send</Text>
                    </>}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </BlurView>

        {/* Search bar */}
        <View style={[F.searchWrap, { backgroundColor: ct.inputBg, borderColor: ct.border }]}>
          <Ionicons name="search" size={18} color={ct.dim} />
          <TextInput
            style={[F.searchInput, { color: ct.primary }]}
            placeholder="Search users or chats"
            placeholderTextColor={ct.dim}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={ct.dim} />
            </TouchableOpacity>
          )}
        </View>

        {/* Selected chips */}
        {chips.length > 0 && (
          <FlatList
            data={chips}
            keyExtractor={(c) => c.key}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6 }}
            renderItem={({ item }) => (
              <View style={[F.chip, { backgroundColor: ct.chipBg, borderColor: ct.chipBd }]}>
                <Text style={[F.chipTxt, { color: ct.primary }]} numberOfLines={1}>{item.label}</Text>
                <TouchableOpacity onPress={item.onRemove} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close" size={14} color={ct.primary} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            )}
          />
        )}

        {/* Body */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={ct.accent} />
        ) : searching ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={ct.accent} />
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={14}
            maxToRenderPerBatch={16}
            windowSize={11}
            removeClippedSubviews
            ListEmptyComponent={
              <View style={F.empty}>
                <Ionicons name="chatbubbles-outline" size={56} color={ct.dim} />
                <Text style={[F.emptyTitle, { color: ct.primary }]}>
                  {query ? 'No matches' : 'Nothing to forward to yet'}
                </Text>
                <Text style={[F.emptySub, { color: ct.secondary }]}>
                  {query ? 'Try a different name' : 'Start a conversation first, then forward from here.'}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      {/* Success flash — sits above everything, fades in/out via Animated */}
      <Animated.View pointerEvents="none" style={[F.successOverlay, { opacity: successOp }]}>
        <View style={[F.successCard, { backgroundColor: ct.surface, borderColor: ct.border }]}>
          <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
          <Text style={[F.successText, { color: ct.primary }]}>
            Forwarded to {selectedCount} {selectedCount === 1 ? 'chat' : 'chats'}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Row styles ──────────────────────────────────────────────────────────
const R = StyleSheet.create({
  row:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 8, borderRadius: 12 },
  avatarWrap:     { marginRight: 12 },
  avatar:         { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '800', fontSize: 16 },
  body:           { flex: 1 },
  titleRow:       { flexDirection: 'row', alignItems: 'center' },
  title:          { fontSize: 15, fontWeight: '600' },
  subtitle:       { fontSize: 12, marginTop: 2 },
  check:          { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});

// ─── Screen styles ───────────────────────────────────────────────────────
const F = StyleSheet.create({
  shell:      { flex: 1 },
  glowWrap:   { position: 'absolute', top: -140, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', height: 420 },
  glow:       { position: 'absolute' },

  header:     {
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 8 : 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn:  { padding: 6, marginRight: 4 },
  headerTitle:{ fontSize: 18, fontWeight: '700' },
  headerSub:  { fontSize: 12, marginTop: 2 },
  sendBtn:    { marginLeft: 8, borderRadius: 20, overflow: 'hidden' },
  sendGrad:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  sendTxt:    { color: '#fff', fontWeight: '700', marginLeft: 6 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginTop: 10, marginBottom: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput:{ flex: 1, fontSize: 15, marginHorizontal: 8, padding: 0 },

  chip:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18, borderWidth: 1, marginRight: 8 },
  chipTxt:    { fontSize: 12, fontWeight: '600', maxWidth: 120 },

  sectionHead:{ fontSize: 11, letterSpacing: 0.6, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 24, marginTop: 18, marginBottom: 6 },

  empty:      { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub:   { fontSize: 13, marginTop: 6, textAlign: 'center' },

  successOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  successCard: {
    paddingVertical: 22, paddingHorizontal: 30,
    borderRadius: 18, borderWidth: 1, alignItems: 'center',
  },
  successText: { marginTop: 12, fontSize: 15, fontWeight: '700' },
});
