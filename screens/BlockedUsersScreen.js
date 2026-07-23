// truevision/screens/BlockedUsersScreen.js
//
// Manage blocked accounts. Two modes:
//   • 'blocked' (default) — paginated, server-searchable list of people you've
//     blocked, with an outline "Unblock" button per row (optimistic removal).
//   • 'block' — reached via the header "+" — searches ALL users so you can
//     block someone new; a danger "Block" button per result. Blocking returns
//     to the refreshed blocked list. The header back-chevron exits the mode.
//
// Backed by userService.getBlockedUsers / blockUser / unblockUser and the
// existing userService.searchUsers endpoint.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, RefreshControl,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import { useConfirm } from '../components/common/ConfirmProvider';
import { useTheme } from '../context/ThemeContext';
import { useProfileNavigation } from '../utils/profileNavigation';
import { useAuth } from '../context/AuthContext';
import userService from '../services/UserService';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

const initials = (name = '?') =>
  String(name).trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';

const displayHandle = (u) => (u?.username ? `@${u.username}` : '');

export default function BlockedUsersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user: me } = useAuth();
  const openProfile = useProfileNavigation();
  const confirm = useConfirm();

  // 'blocked' = manage existing blocks · 'block' = search everyone to block
  const [mode, setMode] = useState('blocked');
  const [query, setQuery] = useState('');

  // Blocked-list state
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Block-mode (global user search) state
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [blockingId, setBlockingId] = useState(null);
  const [unblockingId, setUnblockingId] = useState(null);

  const queryRef = useRef('');
  const debounceRef = useRef(null);
  const listSeq = useRef(0);
  const searchSeq = useRef(0);

  // ── Blocked list loading ───────────────────────────────────────────────
  const load = useCallback(async (p = 1, q = queryRef.current) => {
    const seq = ++listSeq.current;
    const res = await userService.getBlockedUsers({ page: p, limit: PAGE_SIZE, q });
    if (seq !== listSeq.current) return; // a newer request superseded this one
    if (res?.success) {
      const rows = (res.items || []).filter(Boolean);
      setItems((prev) => (p === 1 ? rows : [...prev, ...rows]));
      setPage(res.pagination?.page || p);
      setHasMore((res.pagination?.page || p) < (res.pagination?.pages || 1));
    } else if (p === 1) {
      setHasMore(false);
    }
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, []);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  // ── Global user search (block mode) ────────────────────────────────────
  const runUserSearch = useCallback(async (q) => {
    if (!q) { setResults([]); setSearching(false); return; }
    const seq = ++searchSeq.current;
    setSearching(true);
    const res = await userService.searchUsers(q);
    if (seq !== searchSeq.current) return;
    const rows = (res?.users || []).filter((u) => u && u._id !== me?._id);
    setResults(rows);
    setSearching(false);
  }, [me?._id]);

  // ── Debounced search dispatch (both modes) ─────────────────────────────
  useEffect(() => {
    queryRef.current = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (mode === 'blocked') load(1, queryRef.current);
      else runUserSearch(queryRef.current);
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, mode, load, runUserSearch]);

  // ── Mode transitions ───────────────────────────────────────────────────
  const enterBlockMode = () => {
    setMode('block');
    setQuery('');
    setResults([]);
    setSearching(false);
  };

  const exitBlockMode = (refresh = false) => {
    setMode('blocked');
    setQuery('');
    setResults([]);
    setSearching(false);
    queryRef.current = '';
    if (refresh) {
      setLoading(true);
      load(1, '');
    }
  };

  // ── List paging ────────────────────────────────────────────────────────
  const onRefresh = () => { setRefreshing(true); load(1); };

  const onEndReached = () => {
    if (mode !== 'blocked' || loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    load(page + 1);
  };

  // ── Unblock (optimistic, rollback on failure) ──────────────────────────
  const confirmUnblock = async (u) => {
    const name = displayHandle(u) || u.fullName || 'this user';
    const ok = await confirm({
      title:       `Unblock ${name}?`,
      message:     'They will be able to find your profile and interact with you again.',
      confirmText: 'Unblock',
      icon:        'lock-open-outline',
    });
    if (ok) doUnblock(u);
  };

  const doUnblock = async (u) => {
    const snapshot = items;
    setUnblockingId(u._id);
    setItems((cur) => cur.filter((r) => r._id !== u._id));
    const res = await userService.unblockUser(u._id);
    setUnblockingId(null);
    if (!res?.success) {
      setItems(snapshot);
      Alert.alert('Could not unblock', res?.message || 'Please try again.');
    }
  };

  // ── Block (from global search) ─────────────────────────────────────────
  const confirmBlock = async (u) => {
    const name = displayHandle(u) || u.fullName || 'this user';
    const ok = await confirm({
      title:       `Block ${name}?`,
      message:     "They won't be able to message you, comment on your videos, or find your profile.",
      confirmText: 'Block',
      destructive: true,
      icon:        'ban-outline',
    });
    if (ok) doBlock(u);
  };

  const doBlock = async (u) => {
    setBlockingId(u._id);
    const res = await userService.blockUser(u._id);
    setBlockingId(null);
    if (res?.success) {
      exitBlockMode(true);
    } else {
      Alert.alert('Could not block', res?.message || 'Please try again.');
    }
  };

  // ── Rows ───────────────────────────────────────────────────────────────
  const renderAvatar = (u) => (
    u.profileImage ? (
      <Image source={{ uri: u.profileImage }} style={[S.avatar, { backgroundColor: colors.divider }]} />
    ) : (
      <View style={[S.avatar, S.avatarFallback, { backgroundColor: colors.accent }]}>
        <Text style={S.avatarInitials}>{initials(u.fullName || u.username)}</Text>
      </View>
    )
  );

  const renderIdentity = (u) => (
    <View style={S.body}>
      <View style={S.nameRow}>
        <Text style={[S.name, { color: colors.text }]} numberOfLines={1}>
          {u.fullName || u.username || 'User'}
        </Text>
        {u.isVerified ? (
          <Ionicons name="checkmark-circle" size={14} color={colors.accent} style={{ marginLeft: 4 }} />
        ) : null}
      </View>
      {displayHandle(u) ? (
        <Text style={[S.handle, { color: colors.textMuted }]} numberOfLines={1}>
          {displayHandle(u)}
        </Text>
      ) : null}
    </View>
  );

  const renderBlockedRow = ({ item: u }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => openProfile(u._id)}
      style={[S.row, { borderBottomColor: colors.divider }]}
    >
      {renderAvatar(u)}
      {renderIdentity(u)}
      <TouchableOpacity
        onPress={() => confirmUnblock(u)}
        disabled={unblockingId === u._id}
        style={[S.pillBtn, { borderColor: colors.accent, opacity: unblockingId === u._id ? 0.5 : 1 }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[S.pillBtnText, { color: colors.accent }]}>Unblock</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderSearchRow = ({ item: u }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => openProfile(u._id)}
      style={[S.row, { borderBottomColor: colors.divider }]}
    >
      {renderAvatar(u)}
      {renderIdentity(u)}
      <TouchableOpacity
        onPress={() => confirmBlock(u)}
        disabled={blockingId === u._id}
        style={[S.pillBtn, { borderColor: colors.danger, opacity: blockingId === u._id ? 0.5 : 1 }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {blockingId === u._id ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <Text style={[S.pillBtnText, { color: colors.danger }]}>Block</Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // ── Empty states ───────────────────────────────────────────────────────
  const renderEmpty = () => {
    if (mode === 'block') {
      if (searching) return null; // spinner shown below the search bar
      if (!query.trim()) {
        return (
          <View style={S.empty}>
            <Ionicons name="person-add-outline" size={42} color={colors.textDim} />
            <Text style={[S.emptyTitle, { color: colors.textMuted }]}>Block someone</Text>
            <Text style={[S.emptySub, { color: colors.textDim }]}>
              Search for a person by name or username to block them.
            </Text>
          </View>
        );
      }
      return (
        <View style={S.empty}>
          <Ionicons name="search-outline" size={42} color={colors.textDim} />
          <Text style={[S.emptyTitle, { color: colors.textMuted }]}>No users found</Text>
          <Text style={[S.emptySub, { color: colors.textDim }]}>
            Try a different name or username.
          </Text>
        </View>
      );
    }
    if (query.trim()) {
      return (
        <View style={S.empty}>
          <Ionicons name="search-outline" size={42} color={colors.textDim} />
          <Text style={[S.emptyTitle, { color: colors.textMuted }]}>No matches</Text>
          <Text style={[S.emptySub, { color: colors.textDim }]}>
            None of your blocked users match that search.
          </Text>
        </View>
      );
    }
    return (
      <View style={S.empty}>
        <Ionicons name="shield-checkmark-outline" size={42} color={colors.textDim} />
        <Text style={[S.emptyTitle, { color: colors.textMuted }]}>You haven't blocked anyone</Text>
        <Text style={[S.emptySub, { color: colors.textDim }]}>
          When you block someone, they'll appear here and won't be able to interact with you.
        </Text>
      </View>
    );
  };

  const isBlockedMode = mode === 'blocked';
  const listData = isBlockedMode ? items : results;

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader
        title={isBlockedMode ? 'Blocked Users' : 'Block Someone'}
        onBack={() => (isBlockedMode ? navigation.goBack() : exitBlockMode())}
        right={
          isBlockedMode ? (
            <TouchableOpacity onPress={enterBlockMode} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="person-add-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Search bar */}
      <View style={S.searchWrap}>
        <View style={[S.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={17} color={colors.textDim} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={isBlockedMode ? 'Search blocked users' : 'Search people to block'}
            placeholderTextColor={colors.textDim}
            style={[S.searchInput, { color: colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color={colors.textDim} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Body */}
      {isBlockedMode && loading && items.length === 0 ? (
        <View style={S.center}><ActivityIndicator color={colors.accent} /></View>
      ) : !isBlockedMode && searching ? (
        <View style={S.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(u) => u._id}
          renderItem={isBlockedMode ? renderBlockedRow : renderSearchRow}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            isBlockedMode ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            ) : undefined
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            isBlockedMode && loadingMore ? (
              <View style={{ paddingVertical: 18 }}><ActivityIndicator color={colors.accent} /></View>
            ) : null
          }
          ListEmptyComponent={renderEmpty()}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14.5, marginLeft: 8, paddingVertical: 0 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, marginRight: 12 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '800', fontSize: 15 },

  body: { flex: 1, marginRight: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  handle: { fontSize: 13, marginTop: 1 },

  pillBtn: {
    borderWidth: 1.5, borderRadius: 9,
    paddingHorizontal: 14, paddingVertical: 7,
    minWidth: 78, alignItems: 'center', justifyContent: 'center',
  },
  pillBtnText: { fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 34 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 14 },
  emptySub: { fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 },
});
