// truevision/screens/DiscoverScreen.js
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StatusBar,
  Image, Dimensions, TextInput, ActivityIndicator,
  RefreshControl, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import ScreenContainer    from '../components/ScreenContainer';
import videoService       from '../services/VideoService';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

const FILTERS = [
  { id: 'all',           label: 'All',          gradient: ['#667eea', '#764ba2'] },
  { id: 'entertainment', label: 'Entertainment', gradient: ['#ec4899', '#db2777'] },
  { id: 'music',         label: 'Music',         gradient: ['#8b5cf6', '#7c3aed'] },
  { id: 'sports',        label: 'Sports',        gradient: ['#f97316', '#ea580c'] },
  { id: 'gaming',        label: 'Gaming',        gradient: ['#06b6d4', '#0891b2'] },
  { id: 'tech',          label: 'Tech',          gradient: ['#3b82f6', '#2563eb'] },
  { id: 'food',          label: 'Food',          gradient: ['#ef4444', '#dc2626'] },
  { id: 'travel',        label: 'Travel',        gradient: ['#10b981', '#059669'] },
  { id: 'fashion',       label: 'Fashion',       gradient: ['#f59e0b', '#d97706'] },
  { id: 'education',     label: 'Education',     gradient: ['#6366f1', '#4f46e5'] },
];

export default function DiscoverScreen({ navigation }) {
  const [videos,       setVideos]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const [page,         setPage]         = useState(1);
  const [hasMore,      setHasMore]      = useState(true);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const searchScale = useRef(new Animated.Value(1)).current;
  const searchTimer = useRef(null);

  useEffect(() => {
    if (!isSearchMode) loadByCategory(1, true);
  }, [activeFilter, isSearchMode]);

  const loadByCategory = useCallback(async (p = 1, reset = false) => {
    if (p === 1) setLoading(true);
    const res = await videoService.getFeed(p, 20, 'random', activeFilter);
    if (res.success) {
      const items = res.videos || [];
      setVideos(prev => reset ? items : [...prev, ...items]);
      setHasMore(p < (res.pagination?.pages || 1));
      setPage(p);
    }
    setLoading(false);
    setRefreshing(false);
  }, [activeFilter]);

  const doSearch = useCallback(async (q, p = 1, reset = false) => {
    if (!q.trim()) { setIsSearchMode(false); return; }
    if (p === 1) setLoading(true);
    const res = await videoService.searchVideos(q.trim(), p, 20, activeFilter);
    if (res.success) {
      const items = res.videos || [];
      setVideos(prev => reset ? items : [...prev, ...items]);
      setHasMore(p < (res.pagination?.pages || 1));
      setPage(p);
    }
    setLoading(false);
  }, [activeFilter]);

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    clearTimeout(searchTimer.current);
    if (!text.trim()) { setIsSearchMode(false); loadByCategory(1, true); return; }
    setIsSearchMode(true);
    searchTimer.current = setTimeout(() => doSearch(text, 1, true), 500);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isSearchMode) await doSearch(searchQuery, 1, true);
    else              await loadByCategory(1, true);
  }, [isSearchMode, searchQuery, doSearch, loadByCategory]);

  const handleFilterPress = (filter) => {
    setActiveFilter(filter.id);
    setSearchQuery('');
    setIsSearchMode(false);
  };

  const renderCard = ({ item, index }) => {
    const creator = item.userId?.username || item.userId?.fullName || 'creator';
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => navigation.navigate('VideoPlayer', { video: item })}
        style={{ width: CARD_W, marginLeft: index % 2 === 0 ? 0 : 12, marginBottom: 16 }}
      >
        <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 }}>
          <View style={{ height: CARD_W * 1.5, backgroundColor: '#1e293b' }}>
            {item.thumbnailUrl ? (
              <Image source={{ uri: item.thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="play-circle" size={44} color="rgba(255,255,255,0.3)" />
              </View>
            )}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90 }} />
            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>
                {Math.floor((item.duration || 0) / 60)}:{((item.duration || 0) % 60).toString().padStart(2, '0')}
              </Text>
            </View>
            {item.category && (
              <View style={{ position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(59,130,246,0.9)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
                <Text style={{ color: 'white', fontSize: 9, fontWeight: '700', textTransform: 'capitalize' }}>{item.category}</Text>
              </View>
            )}
            <View style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -22, marginLeft: -22 }}>
              <LinearGradient colors={['rgba(59,130,246,0.9)', 'rgba(139,92,246,0.9)']} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="play" size={20} color="white" style={{ marginLeft: 2 }} />
              </LinearGradient>
            </View>
          </View>
          <View style={{ padding: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 5, lineHeight: 17 }} numberOfLines={2}>
              {item.title || `Video by @${creator}`}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginRight: 5 }}>
                <Text style={{ fontSize: 9, fontWeight: '700' }}>{creator.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: '500' }} numberOfLines={1}>@{creator}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={{ backgroundColor: 'white', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
      <Text style={{ fontSize: 32, fontWeight: '900', color: '#0f172a', letterSpacing: -1, marginBottom: 4 }}>Discover</Text>
      <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>Explore authentic videos by category</Text>

      <Animated.View style={{ transform: [{ scale: searchScale }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, borderWidth: 2, borderColor: searchFocused ? '#3b82f6' : 'transparent' }}>
          <Ionicons name="search" size={18} color={searchFocused ? '#3b82f6' : '#9ca3af'} />
          <TextInput
            placeholder="Search videos, topics, creators..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => { setSearchFocused(true); Animated.spring(searchScale, { toValue: 1.02, useNativeDriver: true }).start(); }}
            onBlur={() => { setSearchFocused(false); Animated.spring(searchScale, { toValue: 1, useNativeDriver: true }).start(); }}
            style={{ flex: 1, fontSize: 14, color: '#0f172a', marginLeft: 10, fontWeight: '500' }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange('')} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={14} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={FILTERS} keyExtractor={i => i.id}
        contentContainerStyle={{ paddingRight: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleFilterPress(item)} activeOpacity={0.8} style={{ marginRight: 10 }}>
            {activeFilter === item.id ? (
              <LinearGradient colors={item.gradient} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: 'white' }}>{item.label}</Text>
              </LinearGradient>
            ) : (
              <View style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 14, backgroundColor: '#f3f4f6' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280' }}>{item.label}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );

  return (
    <ScreenContainer backgroundColor="#f8fafc" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {loading && videos.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#6b7280', marginTop: 16 }}>Loading videos…</Text>
        </View>
      ) : (
        <FlatList
          ListHeaderComponent={renderHeader}
          data={videos}
          keyExtractor={(item, i) => item._id || String(i)}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 24 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={renderCard}
          onEndReached={() => { if (hasMore && !loading) { isSearchMode ? doSearch(searchQuery, page + 1) : loadByCategory(page + 1); } }}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
          ListFooterComponent={hasMore && !loading ? <ActivityIndicator size="small" color="#3b82f6" style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
              <Ionicons name="videocam-off" size={56} color="#cbd5e1" />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 }}>No Videos Found</Text>
              <Text style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 48, marginTop: 8 }}>
                Try a different category or search term
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}
