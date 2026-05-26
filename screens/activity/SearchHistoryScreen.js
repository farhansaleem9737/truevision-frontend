// truevision/screens/activity/SearchHistoryScreen.js
//
// Recent search queries, newest first. Backed by /api/activity/search-history.
// Recording happens on demand via activityService.recordSearch(query) — call
// it from your search bar on submit / blur. Queries are stored lowercase and
// deduped server-side.

import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/settings/ScreenHeader';
import { useTheme } from '../../context/ThemeContext';
import activityService from '../../services/ActivityService';

const timeAgo = (date) => {
  if (!date) return '';
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60)     return 'now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function SearchHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await activityService.getSearchHistory(60);
    if (res?.success) setItems(res.items || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const clearAll = () => {
    if (items.length === 0) return;
    Alert.alert(
      'Clear search history',
      "This deletes every search you've made. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all', style: 'destructive',
          onPress: async () => {
            await activityService.clearSearches();
            setItems([]);
          },
        },
      ],
    );
  };

  const removeOne = (id) => {
    setItems((prev) => prev.filter((r) => r._id !== id));
    activityService.deleteSearch(id);
  };

  const renderItem = ({ item }) => (
    <View style={[S.row, { borderBottomColor: colors.divider }]}>
      <View style={[S.iconWrap, { backgroundColor: colors.iconChipBg }]}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
      </View>
      <View style={S.body}>
        <Text style={[S.query, { color: colors.text }]} numberOfLines={1}>{item.query}</Text>
        <Text style={[S.time, { color: colors.textDim }]}>{timeAgo(item.searchedAt)}</Text>
      </View>
      <TouchableOpacity onPress={() => removeOne(item._id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={20} color={colors.textDim} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader
        title="Search History"
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
          ListEmptyComponent={
            <View style={S.empty}>
              <Ionicons name="search-outline" size={42} color={colors.textDim} />
              <Text style={[S.emptyTitle, { color: colors.textMuted }]}>No search history</Text>
              <Text style={[S.emptySub, { color: colors.textDim }]}>
                Queries you search for will appear here.
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
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  body: { flex: 1 },
  query: { fontSize: 15, fontWeight: '600' },
  time:  { fontSize: 11.5, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 14 },
  emptySub:   { fontSize: 13, marginTop: 6, textAlign: 'center' },
});
