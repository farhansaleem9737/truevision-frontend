// truevision/screens/DiscoverScreen.js
//
// Instagram-style Explore screen, tuned for informative content (tech,
// education, business, etc.). Layout:
//
//   ┌─────────────────────────────┐
//   │ [search bar — sticky] Cancel│
//   │ [chip] [chip] [chip] …      │ ← horizontal-scroll informative chips
//   │ ┌──┬──┬──┐                  │
//   │ │  │  │  │  3-col edge-to-  │
//   │ ├──┼──┼──┤   edge grid,     │
//   │ │  │  │  │   2px gaps       │
//   │ └──┴──┴──┘                  │
//   └─────────────────────────────┘
//
// Searching pivots into a premium tabbed results view (Top / Users / Videos /
// Hashtags) with rich, followable people rows + skeleton loading. The whole
// search surface is purple-branded and theme-aware via useSearchTheme.
// Tapping a tile pushes the in-tab `ReelsFeed` so the bottom tab bar stays
// visible (the Discover tab has its own stack — see BottomTabNavigator).

import { useCallback, useEffect, useRef, useState, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StatusBar, Keyboard,
  Dimensions, TextInput, ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons }          from '@expo/vector-icons';
import videoService          from '../services/VideoService';
import userService           from '../services/UserService';
import activityService       from '../services/ActivityService';
import { useProfileNavigation } from '../utils/profileNavigation';
import SearchTabs            from '../components/discover/SearchTabs';
import UserResultRow         from '../components/discover/UserResultRow';
import HashtagResultRow      from '../components/discover/HashtagResultRow';
import RecentSearches        from '../components/discover/RecentSearches';
import { SearchRowsSkeleton, SearchGridSkeleton } from '../components/discover/SearchSkeleton';
import { useSearchTheme }    from '../components/discover/searchTheme';
import {
  getRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches,
} from '../utils/recentSearches';

const { width } = Dimensions.get('window');
const GAP    = 2;
const COLS   = 3;
const TILE   = (width - GAP * (COLS - 1)) / COLS;

// How many people to preview on the "Top" tab before the "View more" affordance.
const TOP_PEOPLE = 4;

// Category chips. Map UI label → backend category value(s).
//
// "For You" sends NO category filter — it must surface EVERY public video
// (uploads use categories like other/sports/travel too), and the backend's
// `trending` sort already ranks by the recommendation algorithm (rankingScore =
// informativeScore + tagScore + engagementScore), so informative/educational
// content still floats to the top. Hard-filtering "For You" to a fixed list was
// the "No content available" bug — it hid every non-informative upload.
const CHIPS = [
  { id: 'foryou',       label: 'For You',           categories: '' },
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

// seconds → M:SS (empty when unknown so we don't render a "0:00" badge).
const fmtDur = (s) => {
  const sec = Math.max(0, Math.round(Number(s) || 0));
  if (!sec) return '';
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
};

// Pretty category label for the badge. Falls back to a title-cased raw value.
const CAT_LABEL = {
  education: 'Education', tech: 'Tech', programming: 'Programming', business: 'Business',
  finance: 'Finance', islamic: 'Islamic', motivation: 'Motivation', news: 'News',
  productivity: 'Productivity', entertainment: 'Entertainment', sports: 'Sports',
  travel: 'Travel', food: 'Food', music: 'Music', gaming: 'Gaming', fashion: 'Fashion',
};
const catLabel = (c) => CAT_LABEL[c] || (c ? c[0].toUpperCase() + c.slice(1) : '');

// ─── Skeleton tile while loading ─────────────────────────────────────────────
const SKELETON = Array.from({ length: 9 }, (_, i) => ({ _id: `skel-${i}` }));

// ─── Lightweight mount fade+rise, used to ease result/tab transitions ────────
const FadeInView = ({ children, style }) => {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line
  return (
    <Animated.View style={[{ flex: 1, opacity: op, transform: [{ translateY: ty }] }, style]}>
      {children}
    </Animated.View>
  );
};

// ─── Memoised explore tile — thumbnail + category + duration + views ────────
// memo() so re-renders of the grid (pagination) don't re-render every tile.
const ExploreTile = memo(({ video, onPress, bg }) => {
  const dur = fmtDur(video.duration);
  const cat = catLabel(video.category);
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[S.tile, bg ? { backgroundColor: bg } : null]}>
      {video.thumbnailUrl ? (
        <ExpoImage
          source={{ uri: video.thumbnailUrl }}
          style={S.thumb}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={video._id}
          transition={160}
        />
      ) : (
        <View style={[S.thumb, S.thumbPlaceholder]}>
          <Ionicons name="videocam-outline" size={20} color="rgba(148,163,184,0.6)" />
        </View>
      )}

      {/* Category badge (top-left) */}
      {cat ? (
        <View style={S.catBadge}>
          <Text style={S.catBadgeText} numberOfLines={1}>{cat}</Text>
        </View>
      ) : null}

      {/* Play glyph (top-right) */}
      <View style={S.playPill}>
        <Ionicons name="play" size={9} color="#fff" style={{ marginLeft: 1 }} />
      </View>

      {/* Views (bottom-left) */}
      <View style={S.views}>
        <Ionicons name="play" size={10} color="#fff" />
        <Text style={S.viewsText}>{fmt(video.viewsCount)}</Text>
      </View>

      {/* Duration (bottom-right) */}
      {dur ? (
        <View style={S.durBadge}>
          <Text style={S.durText}>{dur}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

ExploreTile.displayName = 'ExploreTile';

// ─── Main ────────────────────────────────────────────────────────────────────
export default function DiscoverScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const c = useSearchTheme();
  const openProfile = useProfileNavigation();
  const inputRef = useRef(null);

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

  // "Recent" = the ENTITIES the user actually opened from search (profiles,
  // hashtags, videos) — Instagram-style — NOT the letters/queries they typed.
  // Persisted locally (utils/recentSearches). We deliberately do NOT surface the
  // server-side typed-query history here; that lives in Activity → Search History.
  const [recent, setRecent] = useState([]);
  useEffect(() => { getRecentSearches().then(setRecent); }, []);

  const searchTimer = useRef(null);

  // ── Browse loader ───────────────────────────────────────────────────────
  const loadBrowse = useCallback(async (p = 1, reset = false) => {
    if (p === 1) setLoading(true);
    const chip = CHIPS.find((ch) => ch.id === activeChip) || CHIPS[0];
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
      setSearchLoading(false);
      setSearchUsers([]); setSearchHashtags([]);
      return;
    }
    setIsSearchMode(true);
    setSearchTab('top');
    // Show the skeleton immediately (not a false "No results") while we debounce
    // the actual network fan-out. 300ms feels instant without spamming requests.
    setSearchLoading(true);
    searchTimer.current = setTimeout(() => doSearch(text, 1, true), 300);
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

  // Cancel — leave search mode entirely (mirrors the iOS search "Cancel").
  const cancelSearch = () => {
    clearTimeout(searchTimer.current);
    Keyboard.dismiss();
    inputRef.current?.blur();
    setSearchQuery('');
    setIsSearchMode(false);
    setSearchFocused(false);
    setSearchUsers([]); setSearchHashtags([]);
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

  // NOTE: we no longer store or surface the typed query in Discover. "Recent"
  // holds only the entities the user actually opens (see openUser) —
  // Instagram-style — so a stream of partial queries never pollutes the list.

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

  // Ownership-aware profile open. Before navigating, save the opened PROFILE
  // to Recent (Instagram-style) — the visited entity, not the typed query.
  const openUser = (u) => {
    if (!u?._id) return;
    addRecentSearch({
      type:       'profile',
      id:         u._id,
      username:   u.username,
      name:       u.fullName || u.displayName,
      avatar:     u.profileImage,
      isVerified: u.isVerified,
    }).then(() => getRecentSearches().then(setRecent));
    openProfile(u._id);
  };

  // Reconcile follow toggles back into `searchUsers` so the Top preview and the
  // Users tab (both derived from this one array) never disagree.
  const applyFollowChange = useCallback((userId, next) => {
    setSearchUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, ...next } : u)));
  }, []);

  // ── Recent handlers (entities, Instagram-style) ─────────────────────────
  // Tapping a recent entry re-opens that entity directly. Profiles bump to the
  // top of Recent again via openUser; hashtags/videos re-run the relevant view.
  const pickRecent = (entry) => {
    if (!entry) return;
    if (entry.type === 'profile' || !entry.type) {
      openUser({
        _id: entry.id, username: entry.username, fullName: entry.name,
        profileImage: entry.avatar, isVerified: entry.isVerified,
      });
      return;
    }
    // Hashtag / video fall back to running the search for its label.
    const q = entry.username || entry.name || '';
    if (!q) return;
    Keyboard.dismiss();
    setSearchQuery(q); setIsSearchMode(true); setSearchTab('top');
    clearTimeout(searchTimer.current);
    doSearch(q, 1, true);
  };
  const removeOneRecent = async (entry) => { await removeRecentSearch(entry); setRecent(await getRecentSearches()); };
  const clearAllRecent  = async () => { await clearRecentSearches(); setRecent([]); };

  // ── Renderers ───────────────────────────────────────────────────────────
  // openTile only closes over the stable `navigation`, so it's intentionally
  // omitted from deps to keep the tile callback stable across renders.
  const renderItem = useCallback(({ item, index }) => (
    <ExploreTile video={item} bg={c.skeleton} onPress={() => openTile(item, index, videos)} />
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [videos, navigation, c.skeleton]);

  const renderSkeleton = useCallback(() => <View style={[S.tile, { backgroundColor: c.skeleton }]} />, [c.skeleton]);

  const keyExtractor = useCallback((it, i) => it._id || String(i), []);

  const showCancel = searchFocused || isSearchMode || searchQuery.length > 0;

  // Sticky search bar + chips
  const renderHeader = () => (
    <View style={[S.header, { backgroundColor: c.bg, borderBottomColor: c.divider }]}>
      <View style={S.searchRow}>
        <View style={[
          S.searchBar,
          { backgroundColor: c.iconChipBg, borderColor: 'transparent', flex: 1 },
          searchFocused && { borderColor: c.accent, backgroundColor: c.bg },
        ]}>
          <Ionicons name="search" size={18} color={searchFocused ? c.accent : c.textDim} />
          <TextInput
            ref={inputRef}
            placeholder="Search creators, videos, #tags"
            placeholderTextColor={c.textDim}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleSearchSubmit}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={[S.searchInput, { color: c.text }]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => handleSearchChange('')} hitSlop={S.hit}>
              <Ionicons name="close-circle" size={18} color={c.textDim} />
            </TouchableOpacity>
          ) : null}
        </View>

        {showCancel ? (
          <TouchableOpacity onPress={cancelSearch} hitSlop={S.hit} style={S.cancelBtn}>
            <Text style={[S.cancelText, { color: c.accent }]}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!isSearchMode && !searchFocused ? (
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
                  { backgroundColor: active ? c.text : c.iconChipBg },
                ]}
              >
                <Text style={[
                  S.chipLabel,
                  { color: active ? c.bg : c.textMuted, fontWeight: active ? '700' : '600' },
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

  // Body — Recent / Search-tabs / Browse-grid
  const renderBody = () => {
    // Focused with an empty box → show the visited-entity Recent list (only).
    if (searchFocused && !searchQuery.trim() && recent.length > 0) {
      return (
        <ScrollView keyboardShouldPersistTaps="handled">
          <RecentSearches
            items={recent}
            onPick={pickRecent}
            onRemove={removeOneRecent}
            onClearAll={clearAllRecent}
          />
        </ScrollView>
      );
    }

    if (isSearchMode) {
      return (
        <View style={{ flex: 1 }}>
          <SearchTabs active={searchTab} onChange={setSearchTab} />
          {searchLoading ? (
            searchTab === 'videos'
              ? <SearchGridSkeleton />
              : <SearchRowsSkeleton />
          ) : (
            <FadeInView key={searchTab}>
              {searchTab === 'top'      ? renderTop()
                : searchTab === 'users'    ? renderUsersList()
                : searchTab === 'videos'   ? renderVideosGrid(videos, true)
                : searchTab === 'hashtags' ? renderHashtagsList()
                : null}
            </FadeInView>
          )}
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
      ListFooterComponent={hasMore && !loading
        ? <ActivityIndicator size="small" color={c.accent} style={{ marginVertical: 24 }} />
        : null}
      ListEmptyComponent={
        !loading ? (
          <EmptyState
            c={c}
            icon="videocam-off-outline"
            title="No content available"
            sub="Try a different category or search."
          />
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
        <UserResultRow user={item} onPress={openUser} onFollowChanged={applyFollowChange} />
      )}
      ItemSeparatorComponent={() => <View style={[S.sep, { backgroundColor: c.divider }]} />}
      ListEmptyComponent={!searchLoading ? <EmptyState c={c} icon="people-outline" title="No people found" /> : null}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: 4, paddingBottom: 120 }}
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
      ListEmptyComponent={!searchLoading ? <EmptyState c={c} icon="pricetags-outline" title="No hashtags found" /> : null}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: 4, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderTop = () => {
    const topUsers    = searchUsers.slice(0, TOP_PEOPLE);
    const topHashtags = searchHashtags.slice(0, 4);
    const hasResults  = topUsers.length || topHashtags.length || videos.length;

    if (!searchLoading && !hasResults) {
      return <EmptyState c={c} icon="search" title={`No results for "${searchQuery.trim()}"`} sub="Check the spelling or try a different keyword." />;
    }

    return (
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 130 }}>
        {topUsers.length > 0 && (
          <View>
            <SectionHeader c={c}>People</SectionHeader>
            {topUsers.map((u) => (
              <UserResultRow key={u._id} user={u} onPress={openUser} onFollowChanged={applyFollowChange} />
            ))}
            {searchUsers.length > TOP_PEOPLE && (
              <TouchableOpacity onPress={() => setSearchTab('users')} activeOpacity={0.7} style={S.viewMore}>
                <Text style={[S.viewMoreText, { color: c.accent }]}>View more</Text>
                <Ionicons name="chevron-down" size={16} color={c.accent} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {topHashtags.length > 0 && (
          <View>
            <SectionHeader c={c}>Hashtags</SectionHeader>
            {topHashtags.map((h) => (
              <HashtagResultRow key={h.tag} tag={h.tag} videosCount={h.videosCount}
                onPress={(t) => { setSearchTab('videos'); doSearch(t, 1, true); }} />
            ))}
          </View>
        )}

        {videos.length > 0 && (
          <View>
            <SectionHeader c={c}>Videos</SectionHeader>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
              {videos.slice(0, 6).map((v, i) => (
                <ExploreTile key={v._id || i} video={v} bg={c.skeleton} onPress={() => openTile(v, i, videos)} />
              ))}
            </View>
            {videos.length > 6 && (
              <TouchableOpacity onPress={() => setSearchTab('videos')} style={S.seeAll}>
                <Text style={[S.seeAllText, { color: c.accent }]}>See all videos</Text>
                <Ionicons name="chevron-forward" size={16} color={c.accent} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.statusBarStyle} backgroundColor={c.bg} />
      {renderHeader()}
      {renderBody()}
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SectionHeader = ({ c, children }) => (
  <Text style={[S.section, { color: c.text }]}>{children}</Text>
);

const EmptyState = ({ c, icon, title, sub }) => (
  <View style={S.empty}>
    <View style={[S.emptyIcon, { backgroundColor: c.accentSoft }]}>
      <Ionicons name={icon} size={30} color={c.accent} />
    </View>
    <Text style={[S.emptyTitle, { color: c.text }]}>{title}</Text>
    {sub ? <Text style={[S.emptySub, { color: c.textMuted }]}>{sub}</Text> : null}
  </View>
);

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1 }, // bg injected from theme
  hit:  { top: 10, bottom: 10, left: 10, right: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 82 },

  // Sticky header — bg + borderBottomColor injected from theme
  header: {
    paddingTop: 8, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1,            // bg + borderColor from theme
  },
  searchInput: {
    flex: 1, marginLeft: 10,
    fontSize: 14, paddingVertical: 0,            // color from theme
  },
  cancelBtn:  { paddingLeft: 14, paddingVertical: 4 },
  cancelText: { fontSize: 15, fontWeight: '600' },

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
    backgroundColor: 'rgba(120,120,140,0.12)',
  },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },

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

  // Category badge (top-left)
  catBadge: {
    position: 'absolute', top: 6, left: 6, maxWidth: TILE - 34,
    backgroundColor: 'rgba(108,92,255,0.92)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  catBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },

  // Duration badge (bottom-right)
  durBadge: {
    position: 'absolute', right: 6, bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  durText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Section heading in search results ("People", "Hashtags", "Videos")
  section: {
    fontSize: 15, fontWeight: '800',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },

  // "View more" people affordance
  viewMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 4,
  },
  viewMoreText: { fontSize: 14, fontWeight: '700' },

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
  empty:      { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 30 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 2, textAlign: 'center' },
  emptySub:   { fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 },

  // "See all videos" link in Top tab
  seeAll: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end',
            paddingHorizontal: 16, paddingVertical: 12 },
  seeAllText: { fontSize: 13, fontWeight: '700', marginRight: 4 },
});
