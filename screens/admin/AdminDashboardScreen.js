// truevision/screens/admin/AdminDashboardScreen.js
//
// Moderation dashboard: stat cards + tabbed, searchable, paginated queues.
//   Blocked · Pending review · Review requests · All
// Tapping any item opens AdminReviewDetail. Server-side pagination/filter/search.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import adminService from '../../services/AdminService';
import { A, STATE_COLOR } from './adminTheme';

const TABS = [
  { key: 'blocked',        label: 'Blocked' },
  { key: 'pending_review', label: 'Pending' },
  { key: 'requests',       label: 'Requests' },
  { key: 'all',            label: 'All' },
];

const StatCard = ({ label, value, color }) => (
  <View style={S.stat}>
    <Text style={[S.statValue, { color: color || A.text }]}>{value ?? '—'}</Text>
    <Text style={S.statLabel}>{label}</Text>
  </View>
);

export default function AdminDashboardScreen({ navigation }) {
  const [stats, setStats]   = useState(null);
  const [tab, setTab]       = useState('blocked');
  const [q, setQ]           = useState('');
  const [items, setItems]   = useState([]);
  const [page, setPage]     = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimer = useRef(null);

  const loadStats = useCallback(async () => {
    const res = await adminService.stats().catch(() => null);
    if (res?.success) setStats(res.stats);
  }, []);

  // Load a page for the active tab + query.
  const loadPage = useCallback(async (nextPage, query, activeTab, append) => {
    let rows = [];
    let more = false;
    try {
      if (activeTab === 'requests') {
        const res = await adminService.listReviews({ status: 'pending', q: query, page: nextPage, limit: 20 });
        rows = (res.reviews || []).map((t) => ({
          key: `t_${t._id}`,
          videoId: t.video?._id || t.video,
          title: t.video?.title || '(video)',
          thumbnailUrl: t.video?.thumbnailUrl,
          creator: t.creator,
          state: 'pending',
          sub: t.reason || t.description || 'Review request',
        }));
        more = res.pagination ? nextPage < res.pagination.pages : false;
      } else {
        const res = await adminService.listVideos({ status: activeTab, q: query, page: nextPage, limit: 20 });
        rows = (res.videos || []).map((v) => ({
          key: `v_${v._id}`,
          videoId: v._id,
          title: v.title || 'Untitled',
          thumbnailUrl: v.thumbnailUrl,
          creator: v.creator,
          state: v.reviewStatus,
          sub: v.aiCategory ? `${v.aiCategory} · score ${v.informativeScore ?? '—'}` : (v.review?.reason || ''),
        }));
        more = res.pagination ? nextPage < res.pagination.pages : false;
      }
    } catch (_) { /* handled by empty state */ }

    setItems((prev) => (append ? [...prev, ...rows] : rows));
    setHasMore(more);
    setPage(nextPage);
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Initial + tab changes.
  useEffect(() => { setLoading(true); loadPage(1, q, tab, false); }, [tab]); // eslint-disable-line
  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  // Debounced search.
  const onSearch = (text) => {
    setQ(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setLoading(true); loadPage(1, text, tab, false); }, 400);
  };

  const onEnd = () => { if (hasMore && !loading) loadPage(page + 1, q, tab, true); };

  const logout = async () => { await adminService.logout(); navigation.replace('AdminLogin'); };

  const renderItem = ({ item }) => {
    const color = STATE_COLOR[item.state] || A.dim;
    return (
      <TouchableOpacity style={S.row} activeOpacity={0.85} onPress={() => navigation.navigate('AdminReviewDetail', { videoId: item.videoId })}>
        <ExpoImage source={{ uri: item.thumbnailUrl }} style={S.thumb} contentFit="cover" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={S.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={S.rowCreator} numberOfLines={1}>@{item.creator?.username || 'unknown'}</Text>
          {!!item.sub && <Text style={S.rowSub} numberOfLines={1}>{item.sub}</Text>}
        </View>
        <View style={[S.stateDot, { backgroundColor: color }]} />
        <Ionicons name="chevron-forward" size={18} color={A.dim} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={S.root} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={S.header}>
        <Text style={S.headerTitle}>Moderation</Text>
        <TouchableOpacity onPress={logout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="log-out-outline" size={22} color={A.sub} />
        </TouchableOpacity>
      </View>

      {/* Stat cards */}
      <View style={S.statsRow}>
        <StatCard label="Pending reviews" value={stats?.reviews?.pending} color={A.amber} />
        <StatCard label="Blocked" value={stats?.uploads?.blocked} color={A.red} />
        <StatCard label="In review" value={stats?.uploads?.pendingReview} color={A.amber} />
        <StatCard label="Approved" value={stats?.uploads?.approved} color={A.green} />
      </View>

      {/* Tabs */}
      <View style={S.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[S.tab, tab === t.key && S.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[S.tabText, tab === t.key && S.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={S.search}>
        <Ionicons name="search" size={17} color={A.dim} />
        <TextInput
          style={S.searchInput}
          placeholder="Search title or @creator"
          placeholderTextColor={A.dim}
          value={q}
          onChangeText={onSearch}
          autoCapitalize="none"
        />
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={A.accent} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.key}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          onEndReached={onEnd}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStats(); loadPage(1, q, tab, false); }} tintColor={A.accent} />}
          ListEmptyComponent={
            <View style={S.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={50} color={A.dim} />
              <Text style={S.emptyText}>Nothing here.</Text>
            </View>
          }
          ListFooterComponent={hasMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={A.dim} /> : null}
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root:        { flex: 1, backgroundColor: A.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  headerTitle: { color: A.text, fontSize: 22, fontWeight: '900' },

  statsRow:    { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 12 },
  stat:        { flex: 1, backgroundColor: A.card, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  statValue:   { fontSize: 20, fontWeight: '900' },
  statLabel:   { color: A.dim, fontSize: 10.5, marginTop: 4, textAlign: 'center' },

  tabs:        { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 10 },
  tab:         { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: A.card },
  tabActive:   { backgroundColor: A.accent },
  tabText:     { color: A.sub, fontSize: 13, fontWeight: '700' },
  tabTextActive:{ color: '#fff' },

  search:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, backgroundColor: A.card, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 6 },
  searchInput: { flex: 1, color: A.text, fontSize: 14.5, marginLeft: 8 },

  row:         { flexDirection: 'row', alignItems: 'center', backgroundColor: A.card, borderRadius: 12, padding: 10, marginBottom: 10 },
  thumb:       { width: 58, height: 58, borderRadius: 9, backgroundColor: A.card2 },
  rowTitle:    { color: A.text, fontSize: 14.5, fontWeight: '700' },
  rowCreator:  { color: A.sub, fontSize: 12.5, marginTop: 2 },
  rowSub:      { color: A.dim, fontSize: 11.5, marginTop: 2 },
  stateDot:    { width: 9, height: 9, borderRadius: 5, marginRight: 8 },

  empty:       { alignItems: 'center', paddingTop: 70 },
  emptyText:   { color: A.dim, fontSize: 15, marginTop: 12 },
});
