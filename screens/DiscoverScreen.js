// truevision/screens/DiscoverScreen.js
//
// Instagram-style Explore screen, tuned for informative content (tech,
// education, business, etc.). Layout:
//
//   ┌─────────────────────────────┐
//   │ [search bar — sticky]       │
//   │ [chip] [chip] [chip] …      │ ← horizontal-scroll informative chips
//   │ ┌──┬──┬──┐                  │
//   │ │  │  │  │  3-col edge-to-  │
//   │ ├──┼──┼──┤   edge grid,     │
//   │ │  │  │  │   2px gaps       │
//   │ └──┴──┴──┘                  │
//   └─────────────────────────────┘
//
// Searching pivots into the existing tabbed results (Top / Users / Videos /
// Hashtags + Recent searches).
// Tapping a tile pushes the in-tab `ReelsFeed` so the bottom tab bar stays
// visible (the Discover tab has its own stack — see BottomTabNavigator).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StatusBar, Keyboard,
  Dimensions, TextInput, ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons }          from '@expo/vector-icons';
import videoService          from '../services/VideoService';
import userService           from '../services/UserService';
import activityService       from '../services/ActivityService';
import { useTheme }          from '../context/ThemeContext';
import SearchTabs            from '../components/discover/SearchTabs';
import UserResultRow         from '../components/discover/UserResultRow';
import HashtagResultRow      from '../components/discover/HashtagResultRow';
import RecentSearches        from '../components/discover/RecentSearches';
import {
  getRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches,
} from '../utils/recentSearches';

const { width } = Dimensions.get('window');
const GAP    = 2;
const COLS   = 3;
const TILE   = (width - GAP * (COLS - 1)) / COLS;

// Informative-only category chips. Map UI label → backend category value(s).
const INFORMATIVE_CATEGORIES = ['education', 'tech', 'programming', 'business', 'finance', 'islamic', 'motivation', 'news', 'productivity'];

const CHIPS = [
  { id: 'foryou',       label: 'For You',           categories: INFORMATIVE_CATEGORIES.join(',') },
  { id: 'programming',  label: 'Programming',       categories: 'programming' },
  { id: 'tech',         label: 'AI & Technology',   categories: 'tech' },
  { id: 'business',     label: 'Business',          categories: 'business' },
  { id: 'finance',      label: 'Finance',           categories: 'finance' },
  { id: 'education',    label: 'Education',         categories: 'education' },
  { id: 'motivation',   label: 'Motivation',        categories: 'motivation' },
  { id: 'islamic',      label: 'Islamic Knowledge', categories: 'islamic' },
  { id: 'news',         label: 'News',              categories: 'news' },
  { id: 'productivity', label: 'Productivity',      categories: 'productivity' },
];

const fmt = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

// ─── Skeleton tile while loading ─────────────────────────────────────────────
const SKELETON = Array.from({ length: 9 }, (_, i) => ({ _id: `skel-${i}` }));

// ─── Memoised explore tile — minimal, edge-to-edge ──────────────────────────
const ExploreTile = ({ video, onPress }) => (
  <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={S.tile}>
    {video.thumbnailUrl ? (
      <ExpoImage
        source={{ uri: video.thumbnailUrl }}
        style={S.thumb}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
    ) : (
      <View style={[S.thumb, S.thumbPlaceholder]}>
        <Ionicons name="videocam-outline" size={20} color="rgba(15,23,42,0.35)" />
      </View>
    )}

    {/* Subtle play glyph */}
    <View style={S.playPill}>
      <Ionicons name="play" size={9} color="#fff" style={{ marginLeft: 1 }} />
    </View>

    {/* Views overlay (bottom-left) */}
    <View style={S.views}>
      <Ionicons name="play" size={10} color="#fff" />
      <Text style={S.viewsText}>{fmt(video.viewsCount)}</Text>
    </View>
  </TouchableOpacity>
);

const SkeletonTile = () => <View style={[S.tile, S.skeleton]} />;

// ─── Main ────────────────────────────────────────────────────────────────────
export default function DiscoverScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Browse state
  const [videos,      setVideos]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [activeChip,  setActiveChip]  = useState('foryou');
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);

  // Search state
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchFocused,  setSearchFocused]  = useState(false);
  const [isSearchMode,   setIsSearchMode]   = useState(false);
  const [searchTab,      setSearchTab]      = useState('top');
  const [searchUsers,    setSearchUsers]    = useState([]);
  const [searchHashtags, setSearchHashtags] = useState([]);
  const [searchLoading,  setSearchLoading]  = useState(false);

  const [recent, setRecent] = useState([]);
  useEffect(() => { getRecentSearches().then(setRecent); }, []);

  // Server-backed recent searches (/api/activity/search-history). Shown when
  // the search input is focused & empty; the AsyncStorage list above is only
  // a fallback when the server has nothing (offline / brand-new account).
  const [serverRecent, setServerRecent] = useState([]);

  const searchTimer = useRef(null);

  // ── Browse loader ───────────────────────────────────────────────────────
  const loadBrowse = useCallback(async (p = 1, reset = false) => {
    if (p === 1) setLoading(true);
    const chip = CHIPS.find((c) => c.id === activeChip) || CHIPS[0];
    // Use 'trending' sort so the ranking algorithm (informativeScore + tagScore
    // + engagementScore) decides which videos surface first within each chip.
    const res  = await videoService.getFeed(p, 24, 'trending', chip.categories);
    if (res.success) {
      const items = res.videos || [];
      setVideos((prev) => reset ? items : [...prev, ...items]);
      setHasMore(p < (res.pagination?.pages || 1));
      setPage(p);
    }
    setLoading(false);
    setRefreshing(false);
  }, [activeChip]);

  useEffect(() => {
    if (!isSearchMode) loadBrowse(1, true);
  }, [activeChip, isSearchMode, loadBrowse]);

  // ── Search loader (fans out to videos, users, hashtags) ─────────────────
  const doSearch = useCallback(async (q, p = 1, reset = false) => {
    const trimmed = q.trim();
    if (!trimmed) { setIsSearchMode(false); return; }
    if (p === 1) { setLoading(true); setSearchLoading(true); }

    if (p === 1) {
      const [vidRes, usrRes, tagRes] = await Promise.all([
        videoService.searchVideos(trimmed, 1, 24),
        userService.searchUsers(trimmed),
        videoService.searchHashtags(trimmed, 20),
      ]);
      if (vidRes.success) {
        setVideos(reset ? (vidRes.videos || []) : (prev) => [...prev, ...(vidRes.videos || [])]);
        setHasMore(1 < (vidRes.pagination?.pages || 1));
      }
      setSearchUsers(usrRes.success ? (usrRes.users || []) : []);
      setSearchHashtags(tagRes.success ? (tagRes.hashtags || []) : []);
      setPage(1);
      setSearchLoading(false);
    } else {
      const vidRes = await videoService.searchVideos(trimmed, p, 24);
      if (vidRes.success) {
        setVideos((prev) => [...prev, ...(vidRes.videos || [])]);
        setHasMore(p < (vidRes.pagination?.pages || 1));
        setPage(p);
      }
    }
    setLoading(false);
  }, []);

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    clearTimeout(searchTimer.current);
    if (!text.trim()) {
      setIsSearchMode(false);
      setSearchUsers([]); setSearchHashtags([]);
      return;
    }
    setIsSearchMode(true);
    setSearchTab('top');
    searchTimer.current = setTimeout(() => doSearch(text, 1, true), 500);
  };

  // Explicit submit (keyboard "search" key) — run immediately and record the
  // query in the server-side search history. Fire-and-forget: history is a
  // nicety, search results must never wait on it.
  const handleSearchSubmit = () => {
    const q = searchQuery.trim();
    if (!q) return;
    clearTimeout(searchTimer.current);
    setIsSearchMode(true);
    setSearchTab('top');
    doSearch(q, 1, true);
    activityService.recordSearch(q);
  };

  // Deep link from SearchHistoryScreen (Activity → Search History → row tap):
  // DiscoverMain receives { initialQuery, searchTs } and re-runs the query.
  // Keyed on searchTs so tapping the same query twice still re-fires.
  useEffect(() => {
    const q = (route?.params?.initialQuery || '').trim();
    if (!q) return;
    setSearchQuery(q);
    setIsSearchMode(true);
    setSearchTab('top');
    clearTimeout(searchTimer.current);
    doSearch(q, 1, true);
    activityService.recordSearch(q);
    navigation.setParams({ initialQuery: undefined, searchTs: undefined });
    // eslint-disable-next-line
  }, [route?.params?.searchTs]);

  // Refresh the server-backed recent list whenever the (empty) search input
  // gains focus, so freshly recorded queries show up immediately.
  useEffect(() => {
    if (!searchFocused || searchQuery.trim()) return;
    let alive = true;
    activityService.getSearchHistory(10).then((res) => {
      if (alive && res?.success) setServerRecent(res.items || []);
    });
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [searchFocused]);

  // Persist successful searches
  useEffect(() => {
    if (!isSearchMode || !searchQuery.trim()) return;
    if (!videos.length && !searchUsers.length && !searchHashtags.length) return;
    addRecentSearch(searchQuery.trim()).then(() => getRecentSearches().then(setRecent));
    // eslint-disable-next-line
  }, [isSearchMode, videos.length, searchUsers.length, searchHashtags.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isSearchMode) await doSearch(searchQuery, 1, true);
    else              await loadBrowse(1, true);
  }, [isSearchMode, searchQuery, doSearch, loadBrowse]);

  const handleChipPress = (chip) => {
    if (chip.id === activeChip) return;
    setActiveChip(chip.id);
    setSearchQuery('');
    setIsSearchMode(false);
  };

  // ── Open the tapped tile in the in-tab reel viewer ──────────────────────
  const openTile = (item, index, list) => {
    navigation.navigate('ReelsFeed', {
      videos: list,
      initialIndex: index,
      source: 'discover',
    });
  };

  // ── Recent searches handlers ────────────────────────────────────────────
  const pickRecent = (q) => {
    setSearchQuery(q); setIsSearchMode(true); setSearchTab('top');
    Keyboard.dismiss();
    clearTimeout(searchTimer.current);
    doSearch(q, 1, true);
    activityService.recordSearch(q); // fire-and-forget — bumps recency
  };
  const removeOneRecent = async (q) => { await removeRecentSearch(q); setRecent(await getRecentSearches()); };
  const clearAllRecent  = async () => { await clearRecentSearches(); setRecent([]); };

  // Server-backed recent rows: optimistic removal, fire-and-forget delete.
  const removeServerRecent = (id) => {
    setServerRecent((prev) => prev.filter((r) => r._id !== id));
    activityService.deleteSearch(id);
  };
  const clearServerRecent = () => {
    setServerRecent([]);
    activityService.clearSearches();
    // Keep the local AsyncStorage mirror consistent with the user's intent.
    clearRecentSearches();
    setRecent([]);
  };

  // ── Renderers ───────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item, index }) => (
    <ExploreTile video={item} onPress={() => openTile(item, index, videos)} />
  ), [videos, navigation]);

  const renderSkeleton = useCallback(() => <SkeletonTile />, []);

  const keyExtractor = useCallback((it, i) => it._id || String(i), []);

  // Sticky search bar + chips
  const renderHeader = () => (
    <View style={[S.header, { backgroundColor: colors.bg, borderBottomColor: colors.divider }]}>
      <View style={[
        S.searchBar,
        { backgroundColor: colors.iconChipBg, borderColor: 'transparent' },
        searchFocused && { borderColor: colors.accent, backgroundColor: colors.bg },
      ]}>
        <Ionicons name="search" size={18} color={searchFocused ? colors.accent : colors.textDim} />
        <TextInput
          placeholder="Search videos, topics, creators..."
          placeholderTextColor={colors.textDim}
          value={searchQuery}
          onChangeText={handleSearchChange}
          onSubmitEditing={handleSearchSubmit}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={[S.searchInput, { color: colors.text }]}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => handleSearchChange('')} hitSlop={S.hit}>
            <Ionicons name="close-circle" size={18} color={colors.textDim} />
          </TouchableOpacity>
        ) : null}
      </View>

      {!isSearchMode ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CHIPS}
          keyExtractor={(i) => i.id}
          contentContainerStyle={S.chipsRow}
          renderItem={({ item }) => {
            const active = item.id === activeChip;
            return (
              <TouchableOpacity
                onPress={() => handleChipPress(item)}
                activeOpacity={0.7}
                style={[
                  S.chip,
                  { backgroundColor: active ? colors.text : colors.iconChipBg },
                ]}
              >
                <Text style={[
                  S.chipLabel,
                  { color: active ? colors.bg : colors.textMuted, fontWeight: active ? '700' : '600' },
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      ) : null}
    </View>
  );

  // Server-backed "Recent" section — clock-icon rows, X to delete, Clear all.
  const renderServerRecent = () => (
    <View style={S.recentWrap}>
      <View style={S.recentHeader}>
        <Text style={[S.recentTitle, { color: colors.text }]}>Recent</Text>
        <TouchableOpacity onPress={clearServerRecent} hitSlop={S.hit}>
          <Text style={[S.recentClear, { color: colors.accent }]}>Clear all</Text>
        </TouchableOpacity>
      </View>
      {serverRecent.map((r) => (
        <TouchableOpacity
          key={r._id}
          onPress={() => pickRecent(r.query)}
          activeOpacity={0.6}
          style={S.recentRow}
        >
          <View style={[S.recentIconWrap, { backgroundColor: colors.iconChipBg }]}>
            <Ionicons name="time-outline" size={18} color={colors.textMuted} />
          </View>
          <Text style={[S.recentQuery, { color: colors.text }]} numberOfLines={1}>{r.query}</Text>
          <TouchableOpacity onPress={() => removeServerRecent(r._id)} hitSlop={S.hit} style={S.recentRemove}>
            <Ionicons name="close" size={16} color={colors.textDim} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Body — Recent / Search-tabs / Browse-grid
  const renderBody = () => {
    if (searchFocused && !searchQuery.trim() && (serverRecent.length > 0 || recent.length > 0)) {
      return (
        <ScrollView keyboardShouldPersistTaps="handled">
          {serverRecent.length > 0 ? renderServerRecent() : (
            <RecentSearches
              items={recent}
              onPick={pickRecent}
              onRemove={removeOneRecent}
              onClearAll={clearAllRecent}
            />
          )}
        </ScrollView>
      );
    }

    if (isSearchMode) {
      return (
        <View style={{ flex: 1 }}>
          <SearchTabs active={searchTab} onChange={setSearchTab} />
          {searchLoading ? (
            <View style={S.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
          ) : searchTab === 'top'      ? renderTop()
            : searchTab === 'users'    ? renderUsersList()
            : searchTab === 'videos'   ? renderVideosGrid(videos, true)
            : searchTab === 'hashtags' ? renderHashtagsList()
            : null}
        </View>
      );
    }

    if (loading && videos.length === 0) {
      return (
        <FlatList
          data={SKELETON}
          keyExtractor={(it) => it._id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, paddingBottom: 120 }}
          renderItem={renderSkeleton}
          scrollEnabled={false}
        />
      );
    }

    return renderVideosGrid(videos);
  };

  // Reusable 3-col grid
  const renderVideosGrid = (data, paginated = false) => (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      numColumns={COLS}
      columnWrapperStyle={{ gap: GAP }}
      contentContainerStyle={{ gap: GAP, paddingBottom: 120 }}
      renderItem={renderItem}
      onEndReached={() => {
        if (!hasMore || loading) return;
        if (paginated && isSearchMode) doSearch(searchQuery, page + 1);
        else if (!isSearchMode)        loadBrowse(page + 1);
      }}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      ListFooterComponent={hasMore && !loading
        ? <ActivityIndicator size="small" color="#3b82f6" style={{ marginVertical: 24 }} />
        : null}
      ListEmptyComponent={
        !loading ? (
          <View style={S.empty}>
            <Ionicons name="videocam-off-outline" size={42} color="#cbd5e1" />
            <Text style={S.emptyTitle}>No content available</Text>
            <Text style={S.emptySub}>Try a different category or search.</Text>
          </View>
        ) : null
      }
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      windowSize={5}
      initialNumToRender={12}
      maxToRenderPerBatch={9}
    />
  );

  // ── Search-result tab renderers ─────────────────────────────────────────
  const renderUsersList = () => (
    <FlatList
      data={searchUsers}
      keyExtractor={(it) => it._id}
      renderItem={({ item }) => (
        <UserResultRow user={item} onPress={(u) => navigation.navigate('UserProfile', { userId: u._id })} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: '#f1f5f9', marginLeft: 78 }} />}
      ListEmptyComponent={!searchLoading ? <Empty label="No users found" /> : null}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: 6, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderHashtagsList = () => (
    <FlatList
      data={searchHashtags}
      keyExtractor={(it) => it.tag}
      renderItem={({ item }) => (
        <HashtagResultRow
          tag={item.tag} videosCount={item.videosCount}
          onPress={(t) => { setSearchTab('videos'); doSearch(t, 1, true); }}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: '#f1f5f9', marginLeft: 76 }} />}
      ListEmptyComponent={!searchLoading ? <Empty label="No hashtags found" /> : null}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: 6, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderTop = () => {
    const topUsers    = searchUsers.slice(0, 3);
    const topHashtags = searchHashtags.slice(0, 4);
    return (
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 130 }}>
        {topUsers.length > 0 && (
          <View>
            <Section>People</Section>
            {topUsers.map((u) => (
              <UserResultRow key={u._id} user={u}
                onPress={(usr) => navigation.navigate('UserProfile', { userId: usr._id })} />
            ))}
          </View>
        )}
        {topHashtags.length > 0 && (
          <View>
            <Section>Hashtags</Section>
            {topHashtags.map((h) => (
              <HashtagResultRow key={h.tag} tag={h.tag} videosCount={h.videosCount}
                onPress={(t) => { setSearchTab('videos'); doSearch(t, 1, true); }} />
            ))}
          </View>
        )}
        {videos.length > 0 && (
          <View>
            <Section>Videos</Section>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
              {videos.slice(0, 6).map((v, i) => (
                <ExploreTile key={v._id || i} video={v} onPress={() => openTile(v, i, videos)} />
              ))}
            </View>
            {videos.length > 6 && (
              <TouchableOpacity onPress={() => setSearchTab('videos')} style={S.seeAll}>
                <Text style={S.seeAllText}>See all videos</Text>
                <Ionicons name="chevron-forward" size={16} color="#3b82f6" />
              </TouchableOpacity>
            )}
          </View>
        )}
        {!searchLoading && !topUsers.length && !topHashtags.length && !videos.length && (
          <Empty label={`No results for "${searchQuery}"`} />
        )}
      </ScrollView>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      {renderHeader()}
      {renderBody()}
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const Section = ({ children }) => (
  <Text style={{
    fontSize: 11.5, fontWeight: '800', color: '#64748b',
    letterSpacing: 0.6, textTransform: 'uppercase',
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6,
  }}>{children}</Text>
);

const Empty = ({ label }) => (
  <View style={S.empty}>
    <Ionicons name="search" size={42} color="#cbd5e1" />
    <Text style={S.emptyTitle}>{label}</Text>
  </View>
);

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1 }, // bg injected from theme
  hit:  { top: 10, bottom: 10, left: 10, right: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Sticky header — bg + borderBottomColor injected from theme
  header: {
    paddingTop: 8, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginBottom: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1,            // bg + borderColor from theme
  },
  searchInput: {
    flex: 1, marginLeft: 10,
    fontSize: 14, paddingVertical: 0,            // color from theme
  },

  // Chips — bg from theme based on active state
  chipsRow:  { paddingHorizontal: 14, paddingVertical: 4, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 18,
  },
  chipLabel:        { fontSize: 13 },

  // Grid tile
  tile: {
    width: TILE, height: TILE,
    backgroundColor: '#f1f5f9',
  },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  skeleton: { backgroundColor: '#e2e8f0' },

  playPill: {
    position: 'absolute', top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  views: {
    position: 'absolute', left: 6, bottom: 6,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  viewsText: { color: '#fff', fontSize: 10.5, fontWeight: '700', marginLeft: 4 },

  // Server-backed "Recent" searches (focused + empty input)
  recentWrap:   { paddingTop: 4, paddingBottom: 14 },
  recentHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  recentTitle: { fontSize: 14, fontWeight: '800' },
  recentClear: { fontSize: 13, fontWeight: '700' },
  recentRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 16,
  },
  recentIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  recentQuery:  { flex: 1, fontSize: 14.5 },
  recentRemove: { padding: 6 },

  // Empty state
  empty:      { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 14 },
  emptySub:   { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center' },

  // "See all videos" link in Top tab
  seeAll: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end',
            paddingHorizontal: 16, paddingVertical: 12 },
  seeAllText: { fontSize: 13, fontWeight: '700', color: '#3b82f6', marginRight: 4 },
});
