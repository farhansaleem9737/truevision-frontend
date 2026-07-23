// truevision/screens/activity/ViewedProfilesScreen.js
//
// Lists profiles the current user has recently visited. Backed by
// /api/activity/viewed-profiles. Recording is wired from UserProfileScreen —
// activityService.recordProfileView(profileId) fires whenever you open
// another user's profile. Tapping a row here navigates back to that same
// UserProfile screen.

import { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, RefreshControl,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/settings/ScreenHeader';
import { useTheme } from '../../context/ThemeContext';
import { useProfileNavigation } from '../../utils/profileNavigation';
import { useConfirm } from '../../components/common/ConfirmProvider';
import activityService from '../../services/ActivityService';

const timeAgo = (date) => {
  if (!date) return '';
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60)     return 'now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const initials = (name = '?') =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

export default function ViewedProfilesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const openProfile = useProfileNavigation();
  const confirm = useConfirm();

  const [items, setItems]         = useState([]);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(true);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (p = 1) => {
    const res = await activityService.getViewedProfiles(p, 20);
    if (res?.success) {
      const rows = (res.items || []).filter((r) => r.profile);
      setItems((prev) => (p === 1 ? rows : [...prev, ...rows]));
      setPage(res.pagination?.page || p);
      setHasMore((res.pagination?.page || p) < (res.pagination?.pages || 1));
    }
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, []);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(1); };

  const onEndReached = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    load(page + 1);
  };

  const clearAll = async () => {
    if (items.length === 0) return;
    const ok = await confirm({
      title:       'Clear recently viewed',
      message:     'Remove every profile from your recently-viewed list?',
      confirmText: 'Clear all',
      destructive: true,
      icon:        'trash-outline',
    });
    if (!ok) return;
    await activityService.clearProfileViews();
    setItems([]); setPage(1); setHasMore(false);
  };

  const removeOne = (profileId) => {
    setItems((prev) => prev.filter((r) => r.profile._id !== profileId));
    activityService.deleteProfileView(profileId);
  };

  const renderItem = ({ item }) => {
    const u = item.profile;
    return (
      <TouchableOpacity
        onPress={() => openProfile(u._id)}
        activeOpacity={0.7}
        style={[S.row, { borderBottomColor: colors.divider }]}
      >
        {u.profileImage ? (
          <Image source={{ uri: u.profileImage }} style={S.avatar} />
        ) : (
          <View style={[S.avatar, S.avatarFallback, { backgroundColor: colors.accent }]}>
            <Text style={S.avatarInitials}>{initials(u.fullName)}</Text>
          </View>
        )}
        <View style={S.body}>
          <Text style={[S.username, { color: colors.text }]} numberOfLines={1}>
            {u.username || 'user'}
            {u.isVerified ? <Text style={{ color: colors.accent }}>  ✓</Text> : null}
          </Text>
          {u.fullName ? (
            <Text style={[S.sub, { color: colors.textMuted }]} numberOfLines={1}>{u.fullName}</Text>
          ) : null}
          <Text style={[S.time, { color: colors.textDim }]}>Viewed {timeAgo(item.viewedAt)}</Text>
        </View>
        <TouchableOpacity onPress={() => removeOne(u._id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={20} color={colors.textDim} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader
        title="Recently Viewed"
        onBack={() => navigation.goBack()}
        right={
          items.length > 0 ? (
            <TouchableOpacity onPress={clearAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </TouchableOpacity>
          ) : null
        }
      />

      {loading && items.length === 0 ? (
        <View style={S.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r._id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            loadingMore
              ? <View style={{ paddingVertical: 18 }}><ActivityIndicator color={colors.accent} /></View>
              : null
          }
          ListEmptyComponent={
            <View style={S.empty}>
              <Ionicons name="eye-outline" size={42} color={colors.textDim} />
              <Text style={[S.emptyTitle, { color: colors.textMuted }]}>No recent profiles</Text>
              <Text style={[S.emptySub, { color: colors.textDim }]}>
                Profiles you visit will show up here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '800', fontSize: 16 },
  body: { flex: 1 },
  username: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: 1 },
  time: { fontSize: 11.5, marginTop: 3 },
  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 14 },
  emptySub: { fontSize: 13, marginTop: 6, textAlign: 'center' },
});
