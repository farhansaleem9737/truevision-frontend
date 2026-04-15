// truevision/screens/ProfileScreen.js
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar,
  Alert, FlatList, Dimensions, Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient }   from 'expo-linear-gradient';
import { Ionicons }         from '@expo/vector-icons';
import { useAuth }          from '../context/AuthContext';
import ScreenContainer      from '../components/ScreenContainer';
import videoService         from '../services/VideoService';

const { width } = Dimensions.get('window');
const CARD_W    = (width - 48) / 3;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1)     + 'K';
  return String(n);
};

const fmtDur = (s) => {
  if (!s) return '0:00';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

// ── Video card (thumbnail grid) ───────────────────────────────────────────────
const VideoCard = ({ item, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={() => onPress(item)}
    style={{ width: CARD_W, height: CARD_W * 1.6, marginBottom: 6 }}
  >
    <View style={{
      flex: 1, borderRadius: 12, overflow: 'hidden',
      backgroundColor: '#1e293b',
    }}>
      {item.thumbnailUrl ? (
        <Image
          source={{ uri: item.thumbnailUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.5)" />
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 6 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="eye" size={11} color="white" />
            <Text style={{ color: 'white', fontSize: 10, marginLeft: 3, fontWeight: '700' }}>
              {fmt(item.viewsCount)}
            </Text>
          </View>
          <View style={{
            backgroundColor: 'rgba(0,0,0,0.7)',
            paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
          }}>
            <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>
              {fmtDur(item.duration)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Category pill */}
      {item.category && (
        <View style={{
          position: 'absolute', top: 5, left: 5,
          backgroundColor: 'rgba(59,130,246,0.85)',
          paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
        }}>
          <Text style={{ color: 'white', fontSize: 9, fontWeight: '700', textTransform: 'capitalize' }}>
            {item.category}
          </Text>
        </View>
      )}
    </View>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [activeTab,     setActiveTab]     = useState('videos');
  const [myVideos,      setMyVideos]      = useState([]);
  const [savedVideos,   setSavedVideos]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [videosPage,    setVideosPage]    = useState(1);
  const [savedPage,     setSavedPage]     = useState(1);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [hasMoreSaved,  setHasMoreSaved]  = useState(true);

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (user?._id || user?.id) {
      loadMyVideos(1, true);
      loadSavedVideos(1, true);
    }
  }, [user]);

  const loadMyVideos = useCallback(async (page = 1, reset = false) => {
    if (!user?._id && !user?.id) return;
    if (page === 1) setLoading(true);
    const userId = user._id || user.id;
    const res = await videoService.getUserVideos(userId, page, 12);
    if (res.success) {
      const newItems = res.videos || [];
      setMyVideos(prev => reset ? newItems : [...prev, ...newItems]);
      setHasMoreVideos(page < (res.pagination?.pages || 1));
      setVideosPage(page);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  const loadSavedVideos = useCallback(async (page = 1, reset = false) => {
    const res = await videoService.getSavedVideos(page, 12);
    if (res.success) {
      const newItems = res.videos || [];
      setSavedVideos(prev => reset ? newItems : [...prev, ...newItems]);
      setHasMoreSaved(page < (res.pagination?.pages || 1));
      setSavedPage(page);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadMyVideos(1, true),
      loadSavedVideos(1, true),
    ]);
  }, [loadMyVideos, loadSavedVideos]);

  const loadMoreVideos = () => {
    if (hasMoreVideos) loadMyVideos(videosPage + 1);
  };
  const loadMoreSaved = () => {
    if (hasMoreSaved) loadSavedVideos(savedPage + 1);
  };

  const handleDeleteVideo = (videoId) => {
    Alert.alert(
      'Delete Video',
      'Are you sure you want to permanently delete this video?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await videoService.deleteVideo(videoId);
            if (res.success) {
              setMyVideos(prev => prev.filter(v => (v._id || v.id) !== videoId));
            } else {
              Alert.alert('Error', res.message || 'Failed to delete video');
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => { await logout(); },
      },
    ]);
  };

  const menuItems = [
    {
      id: 1, title: 'Edit Profile', subtitle: 'Update your information',
      icon: 'person-circle', color: '#3b82f6',
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      id: 2, title: 'Favorites', subtitle: 'Your favorite videos',
      icon: 'star', color: '#f59e0b',
      onPress: () => navigation.navigate('VideoPlayer'),
    },
    {
      id: 3, title: 'Settings', subtitle: 'App preferences and privacy',
      icon: 'settings', color: '#6b7280',
      onPress: () => Alert.alert('Coming Soon', 'Settings feature'),
    },
    {
      id: 4, title: 'Help & Support', subtitle: 'Get help or report issues',
      icon: 'help-circle', color: '#10b981',
      onPress: () => Alert.alert('Coming Soon', 'Help & support feature'),
    },
  ];

  const renderVideoCard = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onLongPress={() => handleDeleteVideo(item._id || item.id)}
      onPress={() => navigation.navigate('VideoPlayer', { video: item })}
      style={{ width: CARD_W, height: CARD_W * 1.6, marginBottom: 6 }}
    >
      <View style={{ flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1e293b' }}>
        {item.thumbnailUrl ? (
          <Image
            source={{ uri: item.thumbnailUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.5)" />
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 6 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="eye" size={11} color="white" />
              <Text style={{ color: 'white', fontSize: 10, marginLeft: 3, fontWeight: '700' }}>
                {fmt(item.viewsCount)}
              </Text>
            </View>
            <View style={{
              backgroundColor: 'rgba(0,0,0,0.7)',
              paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
            }}>
              <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>
                {fmtDur(item.duration)}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {item.category && (
          <View style={{
            position: 'absolute', top: 5, left: 5,
            backgroundColor: 'rgba(59,130,246,0.85)',
            paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
          }}>
            <Text style={{ color: 'white', fontSize: 9, fontWeight: '700', textTransform: 'capitalize' }}>
              {item.category}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSavedCard = ({ item }) => (
    <VideoCard
      item={item}
      onPress={(v) => navigation.navigate('VideoPlayer', { video: v })}
    />
  );

  const currentData = activeTab === 'videos' ? myVideos : savedVideos;

  return (
    <ScreenContainer backgroundColor="#f9fafb" edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#3b82f6" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Header gradient ── */}
        <LinearGradient
          colors={['#3b82f6', '#8b5cf6']}
          style={{ paddingTop: 60, paddingBottom: 120, paddingHorizontal: 24 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Text style={{ color: 'white', fontSize: 28, fontWeight: '900' }}>Profile</Text>
            <TouchableOpacity
              onPress={() => Alert.alert('Coming Soon', 'Notifications feature')}
              style={{ width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="notifications" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 24, marginTop: -80 }}>
          {/* ── Profile card ── */}
          <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }}>
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              {/* Profile image or initials */}
              {user?.profileImage ? (
                <Image
                  source={{ uri: user.profileImage }}
                  style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 16, borderWidth: 3, borderColor: '#3b82f6' }}
                  resizeMode="cover"
                />
              ) : (
                <LinearGradient
                  colors={['#3b82f6', '#8b5cf6']}
                  style={{ width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
                >
                  <Text style={{ color: 'white', fontSize: 40, fontWeight: 'bold' }}>
                    {(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 }}>
                {user?.fullName || 'User'}
              </Text>
              <Text style={{ color: '#64748b', fontSize: 15, marginBottom: 4 }}>
                @{user?.username || 'username'}
              </Text>
              {!!user?.bio && (
                <Text style={{ color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 8, lineHeight: 18 }}>
                  {user.bio}
                </Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <Ionicons name="location" size={13} color="#94a3b8" />
                <Text style={{ color: '#94a3b8', fontSize: 13, marginLeft: 4 }}>
                  {user?.country || 'Unknown'}
                </Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 }}>
              {[
                { label: 'Videos',    value: fmt(myVideos.length),  icon: 'videocam',    color: '#3b82f6' },
                { label: 'Saved',     value: fmt(savedVideos.length), icon: 'bookmark',  color: '#f59e0b' },
                { label: 'Followers', value: '—',                    icon: 'people',     color: '#8b5cf6' },
              ].map((s, i) => (
                <View key={i} style={{ alignItems: 'center' }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: `${s.color}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    <Ionicons name={s.icon} size={22} color={s.color} />
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a' }}>{s.value}</Text>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>{s.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.85}>
              <LinearGradient
                colors={['#3b82f6', '#8b5cf6']}
                style={{ borderRadius: 16, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
              >
                <Ionicons name="create" size={20} color="white" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>Edit Profile</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* ── Tabs (My Videos / Saved) ── */}
          <View style={{ backgroundColor: 'white', borderRadius: 24, marginTop: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
            {/* Tab headers */}
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 16 }}>
              {[
                { id: 'videos', label: 'My Videos', icon: 'grid' },
                { id: 'saved',  label: 'Saved',     icon: 'bookmark' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1, paddingVertical: 12,
                    borderBottomWidth: activeTab === tab.id ? 2 : 0,
                    borderBottomColor: '#3b82f6',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={tab.icon} size={18} color={activeTab === tab.id ? '#3b82f6' : '#94a3b8'} />
                    <Text style={{ marginLeft: 6, fontWeight: '600', color: activeTab === tab.id ? '#3b82f6' : '#94a3b8' }}>
                      {tab.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Hint for long-press delete */}
            {activeTab === 'videos' && myVideos.length > 0 && (
              <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', marginBottom: 10 }}>
                Long-press a video to delete it
              </Text>
            )}

            {loading ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ color: '#94a3b8', marginTop: 12 }}>Loading videos…</Text>
              </View>
            ) : (
              <>
                <FlatList
                  data={currentData}
                  keyExtractor={(item) => item._id || String(item.id)}
                  numColumns={3}
                  columnWrapperStyle={{ justifyContent: 'space-between' }}
                  renderItem={activeTab === 'videos' ? renderVideoCard : renderSavedCard}
                  scrollEnabled={false}
                  onEndReached={activeTab === 'videos' ? loadMoreVideos : loadMoreSaved}
                  onEndReachedThreshold={0.5}
                  ListEmptyComponent={
                    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                      <Ionicons
                        name={activeTab === 'videos' ? 'videocam-outline' : 'bookmark-outline'}
                        size={60} color="#cbd5e1"
                      />
                      <Text style={{ color: '#94a3b8', marginTop: 12, textAlign: 'center' }}>
                        {activeTab === 'videos'
                          ? 'No videos yet.\nTap + to upload your first video!'
                          : 'No saved videos yet'}
                      </Text>
                    </View>
                  }
                />
                {(activeTab === 'videos' ? hasMoreVideos : hasMoreSaved) && currentData.length > 0 && (
                  <TouchableOpacity
                    onPress={activeTab === 'videos' ? loadMoreVideos : loadMoreSaved}
                    style={{ alignItems: 'center', paddingVertical: 12 }}
                  >
                    <Text style={{ color: '#3b82f6', fontWeight: '600' }}>Load more</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* ── Menu ── */}
          <View style={{ marginTop: 16, marginBottom: 8 }}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={item.onPress}
                activeOpacity={0.75}
                style={{
                  backgroundColor: 'white', borderRadius: 16, padding: 16,
                  marginBottom: 8, flexDirection: 'row', alignItems: 'center',
                  shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${item.color}15`, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#0f172a' }}>{item.title}</Text>
                  <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </TouchableOpacity>
            ))}

            {/* Logout */}
            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.75}
              style={{
                backgroundColor: '#fef2f2', borderRadius: 16, padding: 16,
                marginTop: 8, flexDirection: 'row', alignItems: 'center',
              }}
            >
              <View style={{ width: 44, height: 44, backgroundColor: '#fee2e2', borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Ionicons name="log-out" size={22} color="#ef4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: '#ef4444' }}>Logout</Text>
                <Text style={{ fontSize: 13, color: '#fca5a5', marginTop: 2 }}>Sign out of your account</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#fca5a5" />
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 24, alignItems: 'center' }}>
            <Text style={{ color: '#94a3b8', fontSize: 13 }}>TrueVision v1.0.0</Text>
            <Text style={{ color: '#cbd5e1', fontSize: 11, marginTop: 2 }}>Authentic Content Platform</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
