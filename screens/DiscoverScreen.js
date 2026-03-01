import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import pexelsService from '../services/pexelsService';
import ScreenContainer from '../components/ScreenContainer';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function DiscoverScreen({ navigation, route }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(route?.params?.category || 'nature');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const searchScale = useRef(new Animated.Value(1)).current;

  const filters = [
    { id: 'all', label: '✨ All', query: 'nature', gradient: ['#667eea', '#764ba2'] },
    { id: 'nature', label: '🌿 Nature', query: 'nature', gradient: ['#10b981', '#059669'] },
    { id: 'tech', label: '💻 Tech', query: 'technology', gradient: ['#3b82f6', '#2563eb'] },
    { id: 'people', label: '👥 People', query: 'people', gradient: ['#f59e0b', '#d97706'] },
    { id: 'animals', label: '🐾 Animals', query: 'animals', gradient: ['#8b5cf6', '#7c3aed'] },
    { id: 'food', label: '🍔 Food', query: 'food', gradient: ['#ef4444', '#dc2626'] },
    { id: 'travel', label: '✈️ Travel', query: 'travel', gradient: ['#06b6d4', '#0891b2'] },
    { id: 'sports', label: '⚽ Sports', query: 'sports', gradient: ['#f97316', '#ea580c'] },
    { id: 'music', label: '🎵 Music', query: 'music', gradient: ['#ec4899', '#db2777'] },
  ];

  useEffect(() => {
    loadVideos();
  }, [searchQuery]);

  const loadVideos = async () => {
    setLoading(true);
    const result = await pexelsService.searchVideos(searchQuery, 1, 20);
    
    if (result.success) {
      setVideos(result.data.videos || []);
    } else {
      setVideos(getMockVideos());
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVideos();
    setRefreshing(false);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      loadVideos();
    }
  };

  const handleFilterPress = (filter) => {
    setSelectedFilter(filter.id);
    setSearchQuery(filter.query);
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    Animated.spring(searchScale, {
      toValue: 1.02,
      useNativeDriver: true,
    }).start();
  };

  const handleSearchBlur = () => {
    setIsSearchFocused(false);
    Animated.spring(searchScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const getMockVideos = () => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      user: {
        name: `Creator ${i + 1}`,
      },
      video_files: [{
        link: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        quality: 'hd',
      }],
      video_pictures: [{
        picture: `https://picsum.photos/seed/${1000 + i}/600/800`,
      }],
      duration: 15 + (i * 5),
      width: 1920,
      height: 1080,
    }));
  };

  const renderHeader = () => (
    <View style={{
      backgroundColor: 'white',
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 20,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 3,
      marginBottom: 24,
    }}>
      {/* Title */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{
          fontSize: 32,
          fontWeight: '900',
          color: '#111827',
          letterSpacing: -1,
          marginBottom: 4,
        }}>
          Discover
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280' }}>
          Explore thousands of authentic videos
        </Text>
      </View>

      {/* Search Bar */}
      <Animated.View
        style={{
          transform: [{ scale: searchScale }],
        }}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f3f4f6',
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 14,
          marginBottom: 16,
          borderWidth: 2,
          borderColor: isSearchFocused ? '#3b82f6' : 'transparent',
        }}>
          <Ionicons
            name="search"
            size={20}
            color={isSearchFocused ? '#3b82f6' : '#9ca3af'}
          />
          <TextInput
            placeholder="Search videos, topics..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            style={{
              flex: 1,
              fontSize: 15,
              color: '#111827',
              marginLeft: 12,
              fontWeight: '500',
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#e5e7eb',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={16} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Filters */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={filters}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingRight: 24 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handleFilterPress(item)}
            activeOpacity={0.8}
            style={{ marginRight: 10 }}
          >
            {selectedFilter === item.id ? (
              <LinearGradient
                colors={item.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 14,
                  shadowColor: item.gradient[0],
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: 'bold',
                  color: 'white',
                }}>
                  {item.label}
                </Text>
              </LinearGradient>
            ) : (
              <View style={{
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 14,
                backgroundColor: '#f3f4f6',
              }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#6b7280',
                }}>
                  {item.label}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderVideoCard = ({ item, index }) => {
    const thumbnail = item.video_pictures?.[0]?.picture || item.image;
    const duration = item.duration ? Math.floor(item.duration) : 0;
    const creator = item.user?.name || 'Unknown';

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('VideoPlayer', { video: item })}
        style={{
          width: CARD_WIDTH,
          marginLeft: index % 2 === 0 ? 0 : 12,
          marginBottom: 16,
        }}
      >
        <View style={{
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: 'white',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 5,
        }}>
          {/* Thumbnail */}
          <View style={{ height: CARD_WIDTH * 1.5, position: 'relative' }}>
            <Image
              source={{ uri: thumbnail }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
            
            {/* Gradient Overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 100,
                padding: 12,
                justifyContent: 'flex-end',
              }}
            >
              {/* Duration Badge */}
              <View
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
              >
                <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>
                  {duration}s
                </Text>
              </View>
            </LinearGradient>

            {/* Play Icon Overlay */}
            <View
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: -28,
                marginLeft: -28,
              }}
            >
              <LinearGradient
                colors={['rgba(59, 130, 246, 0.9)', 'rgba(139, 92, 246, 0.9)']}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#3b82f6',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <Ionicons name="play" size={24} color="white" style={{ marginLeft: 3 }} />
              </LinearGradient>
            </View>
          </View>

          {/* Info */}
          <View style={{ padding: 12 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: 8,
                lineHeight: 18,
              }}
              numberOfLines={2}
            >
              {item.title || `Video by ${creator}`}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#e5e7eb',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 6,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold' }}>
                    {creator.charAt(0)}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#6b7280',
                    fontWeight: '500',
                  }}
                  numberOfLines={1}
                >
                  {creator}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyComponent = () => (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
      <View style={{
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
      }}>
        <Ionicons name="videocam-off" size={48} color="#cbd5e1" />
      </View>
      <Text style={{
        fontSize: 20,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 8,
      }}>
        No Videos Found
      </Text>
      <Text style={{
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
        paddingHorizontal: 48,
        lineHeight: 20,
      }}>
        Try adjusting your search or filters to find what you're looking for
      </Text>
    </View>
  );

  return (
    <ScreenContainer backgroundColor="#f8fafc" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: 'white',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#3b82f6',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 8,
            marginBottom: 16,
          }}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#6b7280' }}>
            Loading videos...
          </Text>
          <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
            Please wait
          </Text>
        </View>
      ) : (
        <FlatList
          ListHeaderComponent={renderHeader}
          data={videos}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 24 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={renderVideoCard}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
              colors={['#3b82f6']}
            />
          }
          ListEmptyComponent={renderEmptyComponent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}