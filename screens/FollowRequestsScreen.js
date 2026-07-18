// truevision/screens/FollowRequestsScreen.js
//
// Pending follow requests for the signed-in user's private account
// (route: 'FollowRequests', no params).
//
// • Paginated FlatList (infinite scroll + pull-to-refresh)
// • Row: avatar (initials fallback), full name + verified badge, @username,
//   relative "requested x ago" time, Accept (accent solid) + Decline (outline)
// • Accept / Decline remove the row optimistically; on failure the row is
//   re-inserted at its original position and an Alert shows the server message.
// • Row tap → UserProfile of the requester.

import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import { useTheme } from '../context/ThemeContext';
import userService from '../services/UserService';

const ini = (n) => (n || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

const timeAgo = (date) => {
  if (!date) return '';
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60)     return 'now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function FollowRequestsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [items, setItems]             = useState([]);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');

  // Render-time mirror so optimistic rollback can find a row's original index
  // without putting side effects inside a state-setter callback.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const load = useCallback(async (p = 1) => {
    const res = await userService.getFollowRequests(p);

    if (res?.success) {
      const rows = (res.items || []).filter((r) => r?.user?._id);
      setItems((prev) => p === 1
        ? rows
        : [...prev, ...rows.filter((r) => !prev.some((x) => x.user._id === r.user._id))]);
      setPage(res.pagination?.page || p);
      setHasMore((res.pagination?.page || p) < (res.pagination?.pages || 1));
      setErrorMsg('');
    } else if (p === 1) {
      setErrorMsg(res?.message || 'Could not load follow requests.');
    }

    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, []);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(1); };

  const onEndReached = () => {
    if (loading || loadingMore || refreshing || !hasMore || errorMsg) return;
    setLoadingMore(true);
    load(page + 1);
  };

  // ── Accept / Decline (optimistic removal, rollback on failure) ───────────
  const handleAction = async (row, kind) => {
    const id = row.user?._id;
    if (!id) return;

    const idx = itemsRef.current.findIndex((r) => r.user?._id === id);
    setItems((prev) => prev.filter((r) => r.user?._id !== id));

    const res = kind === 'accept'
      ? await userService.acceptFollowRequest(id)
      : await userService.declineFollowRequest(id);

    if (!res?.success) {
      setItems((prev) => {
        if (prev.some((r) => r.user?._id === id)) return prev;
        const copy = [...prev];
        copy.splice(Math.min(Math.max(idx, 0), copy.length), 0, row);
        return copy;
      });
      Alert.alert(
        kind === 'accept' ? 'Could not accept' : 'Could not decline',
        res?.message || 'Try again later.',
      );
    }
  };

  const openProfile = (id) => {
    if (typeof navigation.push === 'function') {
      navigation.push('UserProfile', { userId: id });
    } else {
      navigation.navigate('UserProfile', { userId: id });
    }
  };

  const renderItem = ({ item }) => {
    const u = item.user;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => openProfile(u._id)}
        style={[S.row, { borderBottomColor: colors.divider }]}
      >
        {u.profileImage ? (
          <ExpoImage
            source={{ uri: u.profileImage }}
            style={S.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[S.avatar, S.avatarFallback, { backgroundColor: colors.accent }]}>
            <Text style={S.avatarInitials}>{ini(u.fullName)}</Text>
          </View>
        )}

        <View style={S.body}>
          <View style={S.nameRow}>
            <Text style={[S.fullName, { color: colors.text }]} numberOfLines={1}>
              {u.fullName || 'User'}
            </Text>
            {u.isVerified ? (
              <Ionicons name="checkmark-circle" size={14} color={colors.accent} style={S.verifiedIcon} />
            ) : null}
          </View>
          <Text style={[S.username, { color: colors.textMuted }]} numberOfLines={1}>
            @{u.username || 'user'}
          </Text>
          {item.requestedAt ? (
            <Text style={[S.time, { color: colors.textDim }]}>
              Requested {timeAgo(item.requestedAt)}
            </Text>
          ) : null}
        </View>

        <View style={S.actions}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleAction(item, 'accept')}
            style={[S.acceptBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={S.acceptText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleAction(item, 'decline')}
            style={[S.declineBtn, { borderColor: colors.divider }]}
          >
            <Text style={[S.declineText, { color: colors.text }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderBody = () => {
    if (loading && items.length === 0) {
      return <View style={S.center}><ActivityIndicator color={colors.accent} /></View>;
    }
    if (errorMsg && items.length === 0) {
      return (
        <View style={S.stateWrap}>
          <View style={[S.stateIconWrap, { backgroundColor: colors.iconChipDanger }]}>
            <Ionicons name="cloud-offline-outline" size={38} color={colors.danger} />
          </View>
          <Text style={[S.stateTitle, { color: colors.text }]}>Couldn't load requests</Text>
          <Text style={[S.stateSub, { color: colors.textMuted }]}>{errorMsg}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => { setLoading(true); setErrorMsg(''); load(1); }}
            style={[S.retryBtn, { backgroundColor: colors.accent }]}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={S.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <FlatList
        data={items}
        keyExtractor={(r) => r.user._id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, flexGrow: 1 }}
        ListFooterComponent={
          loadingMore
            ? <View style={S.footerLoader}><ActivityIndicator color={colors.accent} /></View>
            : null
        }
        ListEmptyComponent={
          <View style={S.stateWrap}>
            <View style={[S.stateIconWrap, { backgroundColor: colors.iconChipBg }]}>
              <Ionicons name="person-add-outline" size={38} color={colors.textMuted} />
            </View>
            <Text style={[S.stateTitle, { color: colors.text }]}>No pending requests</Text>
            <Text style={[S.stateSub, { color: colors.textMuted }]}>
              When your account is private, people who want to follow you will
              appear here for your approval.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Follow Requests" onBack={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar:         { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '800', fontSize: 16 },
  body:           { flex: 1, marginRight: 10 },
  nameRow:        { flexDirection: 'row', alignItems: 'center' },
  fullName:       { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  verifiedIcon:   { marginLeft: 4 },
  username:       { fontSize: 13, marginTop: 1 },
  time:           { fontSize: 11.5, marginTop: 3 },

  actions: { alignItems: 'stretch' },
  acceptBtn: {
    paddingHorizontal: 18, paddingVertical: 7, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  acceptText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  declineBtn: {
    marginTop: 6, paddingHorizontal: 18, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  declineText: { fontSize: 12.5, fontWeight: '800' },

  footerLoader: { paddingVertical: 18 },

  stateWrap:     { alignItems: 'center', paddingVertical: 72, paddingHorizontal: 32 },
  stateIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  stateTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  stateSub:   { fontSize: 13.5, marginTop: 8, textAlign: 'center', lineHeight: 19 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 20, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22,
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 14, marginLeft: 6 },
});
