// truevision/screens/FollowListScreen.js
//
// Followers / Following list for any user
// (route: 'FollowList', params: { userId, mode: 'followers' | 'following', username }).
//
// • Paginated FlatList (infinite scroll + pull-to-refresh)
// • Row: avatar (initials fallback), full name + verified badge, @username
// • Row tap → pushes another UserProfile so you can drill through profiles
// • Server-enforced privacy: FOLLOWERS_PRIVATE / ACCOUNT_PRIVATE responses
//   render a full-screen lock state with the server's message.

import { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { useProfileNavigation } from '../utils/profileNavigation';
import userService from '../services/UserService';

const PRIVACY_CODES = ['FOLLOWERS_PRIVATE', 'ACCOUNT_PRIVATE'];

const ini = (n) => (n || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

export default function FollowListScreen({ route, navigation }) {
  const { userId, mode = 'followers', username } = route.params || {};
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const isFollowers = mode !== 'following';
  const title = isFollowers ? 'Followers' : 'Following';

  const [items, setItems]           = useState([]);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [privacyMsg, setPrivacyMsg] = useState('');
  const [errorMsg, setErrorMsg]     = useState('');

  const fetchPage = useCallback(
    (p) => isFollowers
      ? userService.getFollowers(userId, p)
      : userService.getFollowing(userId, p),
    [isFollowers, userId],
  );

  const load = useCallback(async (p = 1) => {
    const res = await fetchPage(p);

    if (res?.success) {
      const rows = (res.items || []).filter((u) => u && u._id);
      setItems((prev) => p === 1
        ? rows
        : [...prev, ...rows.filter((r) => !prev.some((x) => x._id === r._id))]);
      setPage(res.pagination?.page || p);
      setHasMore((res.pagination?.page || p) < (res.pagination?.pages || 1));
      setPrivacyMsg('');
      setErrorMsg('');
    } else if (PRIVACY_CODES.includes(res?.code)) {
      setPrivacyMsg(
        res?.message ||
        (res?.code === 'FOLLOWERS_PRIVATE' ? 'Followers list is private.' : 'This account is private.'),
      );
      setItems([]);
      setHasMore(false);
    } else if (p === 1) {
      setErrorMsg(res?.message || 'Could not load this list.');
    }

    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, [fetchPage]);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(1); };

  const onEndReached = () => {
    if (loading || loadingMore || refreshing || !hasMore || privacyMsg || errorMsg) return;
    setLoadingMore(true);
    load(page + 1);
  };

  // Ownership-aware + push semantics so profile → its follow list → profile →
  // … stays a real drill-down back-stack (own id routes to My Profile).
  const goToProfile = useProfileNavigation();
  const openProfile = (id) => goToProfile(id, { push: true });

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => openProfile(item._id)}
      style={[S.row, { borderBottomColor: colors.divider }]}
    >
      {item.profileImage ? (
        <ExpoImage
          source={{ uri: item.profileImage }}
          style={S.avatar}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[S.avatar, S.avatarFallback, { backgroundColor: colors.accent }]}>
          <Text style={S.avatarInitials}>{ini(item.fullName)}</Text>
        </View>
      )}
      <View style={S.body}>
        <View style={S.nameRow}>
          <Text style={[S.fullName, { color: colors.text }]} numberOfLines={1}>
            {item.fullName || 'User'}
          </Text>
          {item.isVerified ? (
            <Ionicons name="checkmark-circle" size={14} color={colors.accent} style={S.verifiedIcon} />
          ) : null}
        </View>
        <Text style={[S.username, { color: colors.textMuted }]} numberOfLines={1}>
          @{item.username || 'user'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </TouchableOpacity>
  );

  const renderBody = () => {
    if (loading && items.length === 0) {
      return <View style={S.center}><ActivityIndicator color={colors.accent} /></View>;
    }
    if (privacyMsg) {
      return (
        <View style={S.stateWrap}>
          <View style={[S.stateIconWrap, { backgroundColor: colors.iconChipBg }]}>
            <Ionicons name="lock-closed-outline" size={38} color={colors.textMuted} />
          </View>
          <Text style={[S.stateTitle, { color: colors.text }]}>
            {isFollowers ? 'Followers are hidden' : 'Following is hidden'}
          </Text>
          <Text style={[S.stateSub, { color: colors.textMuted }]}>{privacyMsg}</Text>
        </View>
      );
    }
    if (errorMsg && items.length === 0) {
      return (
        <View style={S.stateWrap}>
          <View style={[S.stateIconWrap, { backgroundColor: colors.iconChipDanger }]}>
            <Ionicons name="cloud-offline-outline" size={38} color={colors.danger} />
          </View>
          <Text style={[S.stateTitle, { color: colors.text }]}>Couldn't load list</Text>
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
        keyExtractor={(u) => u._id}
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
              <Ionicons
                name={isFollowers ? 'people-outline' : 'person-add-outline'}
                size={38}
                color={colors.textMuted}
              />
            </View>
            <Text style={[S.stateTitle, { color: colors.text }]}>
              {isFollowers ? 'No followers yet' : 'Not following anyone yet'}
            </Text>
            <Text style={[S.stateSub, { color: colors.textMuted }]}>
              {isFollowers
                ? 'When people follow this account, they\'ll show up here.'
                : 'Accounts this user follows will show up here.'}
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
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      {username ? (
        <View style={[S.subHeader, { borderBottomColor: colors.divider }]}>
          <Text style={[S.subHeaderText, { color: colors.textMuted }]}>@{username}</Text>
        </View>
      ) : null}
      {renderBody()}
    </View>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  subHeader: {
    alignItems: 'center', paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  subHeaderText: { fontSize: 12.5, fontWeight: '600' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar:         { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '800', fontSize: 16 },
  body:           { flex: 1, marginRight: 8 },
  nameRow:        { flexDirection: 'row', alignItems: 'center' },
  fullName:       { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  verifiedIcon:   { marginLeft: 4 },
  username:       { fontSize: 13, marginTop: 1 },

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
