// truevision/screens/TrendingScreen.js
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StatusBar,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import ScreenContainer    from '../components/ScreenContainer';
import videoService       from '../services/VideoService';

const CATEGORIES = [
  { id: 'all',           label: 'All',          icon: 'flame'          },
  { id: 'entertainment', label: 'Entertainment', icon: 'film'           },
  { id: 'music',         label: 'Music',         icon: 'musical-note'   },
  { id: 'sports',        label: 'Sports',        icon: 'football'       },
  { id: 'gaming',        label: 'Gaming',        icon: 'game-controller'},
  { id: 'tech',          label: 'Tech',          icon: 'hardware-chip'  },
  { id: 'food',          label: 'Food',          icon: 'restaurant'     },
  { id: 'travel',        label: 'Travel',        icon: 'airplane'       },
  { id: 'fashion',       label: 'Fashion',       icon: 'shirt'          },
  { id: 'education',     label: 'Education',     icon: 'school'         },
];

const fmt = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1)     + 'K';
  return String(n);
};

export default function TrendingScreen({ navigation }) {
  const [videos,     setVideos]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category,   setCategory]   = useState('all');
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);

  useEffect(() => { loadVideos(1, true); }, [category]);

  const loadVideos = useCallback(async (p = 1, reset = false) => {
    if (p === 1) setLoading(true);
    const res = await videoService.getFeed(p, 15, 'trending', category);
    if (res.success) {
      const items = res.videos || [];
      setVideos(prev => reset ? items : [...prev, ...items]);
      setHasMore(p < (res.pagination?.pages || 1));
      setPage(p);
    }
    setLoading(false);
    setRefreshing(false);
  }, [category]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadVideos(1, true);
  }, [loadVideos]);

  const renderCard = ({ item, index }) => {
    const creator = item.userId?.username || item.userId?.fullName || 'creator';
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('VideoPlayer', { video: item })}
        style={{
          backgroundColor: 'white', borderRadius: 24, overflow: 'hidden',
          marginBottom: 16, marginHorizontal: 16,
          shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
        }}
      >
        {/* Rank badge */}
        <View style={{ position: 'absolute', top: 14, left: 14, zIndex: 10 }}>
          <LinearGradient
            colors={index < 3 ? ['#fbbf24', '#f59e0b'] : ['#6b7280', '#4b5563']}
            style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>{index + 1}</Text>
          </LinearGradient>
        </View>

        {/* Thumbnail */}
        <View style={{ height: 200, backgroundColor: '#1e293b' }}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play-circle" size={56} color="rgba(255,255,255,0.3)" />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.65)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90 }}
          />
          <View style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>
              {Math.floor((item.duration || 0) / 60)}:{((item.duration || 0) % 60).toString().padStart(2, '0')}
            </Text>
          </View>
          {item.category && (
            <View style={{ position: 'absolute', bottom: 12, left: 54, backgroundColor: 'rgba(59,130,246,0.85)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ color: 'white', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>{item.category}</Text>
            </View>
          )}
          <View style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -24, marginLeft: -24 }}>
            <LinearGradient colors={['#3b82f6', '#8b5cf6']} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play" size={22} color="white" style={{ marginLeft: 3 }} />
            </LinearGradient>
          </View>
        </View>

        {/* Info */}
        <View style={{ padding: 14 }}>
          <Text style={{ fontWeight: '800', fontSize: 15, color: '#0f172a', marginBottom: 6 }} numberOfLines={2}>
            {item.title || `Video by @${creator}`}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#3b82f6' }}>{creator.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={{ color: '#64748b', fontWeight: '600', fontSize: 13 }}>@{creator}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
              <Ionicons name="eye" size={16} color="#3b82f6" />
              <Text style={{ color: '#64748b', fontSize: 13, marginLeft: 4, fontWeight: '600' }}>{fmt(item.viewsCount)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
              <Ionicons name="heart" size={16} color="#ef4444" />
              <Text style={{ color: '#64748b', fontSize: 13, marginLeft: 4, fontWeight: '600' }}>{fmt(item.likesCount)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="flame" size={16} color="#f97316" />
              <Text style={{ color: '#f97316', fontSize: 13, marginLeft: 4, fontWeight: '600' }}>Trending</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer backgroundColor="#f9fafb" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      <View style={{ backgroundColor: 'white', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <LinearGradient colors={['#f97316', '#ef4444']} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Ionicons name="flame" size={22} color="white" />
          </LinearGradient>
          <View>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#0f172a' }}>Trending</Text>
            <Text style={{ fontSize: 13, color: '#64748b' }}>Most viewed videos</Text>
          </View>
        </View>

        <FlatList
          horizontal showsHorizontalScrollIndicator={false}
          data={CATEGORIES} keyExtractor={i => i.id}
          contentContainerStyle={{ paddingRight: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setCategory(item.id)} activeOpacity={0.75} style={{ marginRight: 8 }}>
              <LinearGradient
                colors={category === item.id ? ['#3b82f6', '#8b5cf6'] : ['#f3f4f6', '#e5e7eb']}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
              >
                <Ionicons name={item.icon} size={14} color={category === item.id ? 'white' : '#4b5563'} style={{ marginRight: 5 }} />
                <Text style={{ fontWeight: '600', fontSize: 13, color: category === item.id ? 'white' : '#374151' }}>{item.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading && videos.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={{ color: '#94a3b8', marginTop: 12 }}>Loading trending videos…</Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item, i) => item._id || String(i)}
          renderItem={renderCard}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
          onEndReached={() => { if (hasMore && !loading) loadVideos(page + 1); }}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
          ListFooterComponent={hasMore && !loading ? <ActivityIndicator size="small" color="#3b82f6" style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 80 }}>
              <Ionicons name="flame-outline" size={64} color="#cbd5e1" />
              <Text style={{ color: '#94a3b8', marginTop: 16, textAlign: 'center', fontSize: 15 }}>
                {'No trending videos yet.\nBe the first to upload!'}
              </Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
