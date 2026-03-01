import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import pexelsService from '../services/pexelsService';
import ScreenContainer from '../components/ScreenContainer';

const { width } = Dimensions.get('window');

export default function TrendingScreen({ navigation }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All', icon: 'flame' },
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'week', label: 'This Week', icon: 'calendar' },
    { id: 'month', label: 'This Month', icon: 'time' },
  ];

  useEffect(() => {
    loadTrendingVideos();
  }, []);

  const loadTrendingVideos = async () => {
    setLoading(true);
    const result = await pexelsService.getPopularVideos(1, 20);
    
    if (result.success) {
      setVideos(result.data.videos || []);
    } else {
      // Fallback mock data
      setVideos(getMockTrendingVideos());
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrendingVideos();
    setRefreshing(false);
  };

  const getMockTrendingVideos = () => {
    return Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      user: {
        name: `Creator ${i + 1}`,
      },
      video_files: [{
        link: 'https://player.vimeo.com/external/xxx.mp4',
      }],
      video_pictures: [{
        picture: `https://images.pexels.com/videos/${2000 + i}/free-video-${2000 + i}.jpg`,
      }],
      duration: 20 + (i * 3),
      views: Math.floor(Math.random() * 100000) + 10000,
      likes: Math.floor(Math.random() * 5000) + 500,
    }));
  };

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const renderTrendingCard = ({ item, index }) => {
    const thumbnail = item.video_pictures?.[0]?.picture || item.image;
    const duration = item.duration ? Math.floor(item.duration) : 0;
    const creator = item.user?.name || 'Unknown';
    const views = item.views || Math.floor(Math.random() * 50000);
    const likes = item.likes || Math.floor(Math.random() * 2000);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('VideoPlayer', { video: item })}
        className="bg-white rounded-3xl overflow-hidden shadow-sm mb-4 mx-6"
      >
        {/* Rank Badge */}
        <View className="absolute top-4 left-4 z-10">
          <LinearGradient
            colors={index < 3 ? ['#fbbf24', '#f59e0b'] : ['#6b7280', '#4b5563']}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text className="text-white font-black text-lg">
              {index + 1}
            </Text>
          </LinearGradient>
        </View>

        {/* Thumbnail */}
        <View style={{ height: 220, position: 'relative' }}>
          <Image
            source={{ uri: thumbnail }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />

          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 100,
            }}
          />

          {/* Duration */}
          <View className="absolute bottom-4 right-4 bg-black/70 px-3 py-1 rounded-lg">
            <Text className="text-white text-sm font-semibold">
              {duration}s
            </Text>
          </View>

          {/* Play Icon */}
          <View className="absolute inset-0 items-center justify-center">
            <LinearGradient
              colors={['#3b82f6', '#8b5cf6']}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="play" size={28} color="white" />
            </LinearGradient>
          </View>
        </View>

        {/* Info */}
        <View className="p-4">
          <Text className="text-gray-900 font-bold text-lg mb-2" numberOfLines={2}>
            {item.title || `Trending Video by ${creator}`}
          </Text>

          <View className="flex-row items-center mb-3">
            <View className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full items-center justify-center mr-2">
              <Text className="text-white text-xs font-bold">
                {creator.charAt(0)}
              </Text>
            </View>
            <Text className="text-gray-600 text-sm font-medium">
              {creator}
            </Text>
          </View>

          {/* Stats */}
          <View className="flex-row items-center">
            <View className="flex-row items-center mr-4">
              <Ionicons name="eye" size={18} color="#3b82f6" />
              <Text className="text-gray-600 text-sm ml-1 font-semibold">
                {formatNumber(views)}
              </Text>
            </View>
            <View className="flex-row items-center mr-4">
              <Ionicons name="heart" size={18} color="#ef4444" />
              <Text className="text-gray-600 text-sm ml-1 font-semibold">
                {formatNumber(likes)}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="flame" size={18} color="#f97316" />
              <Text className="text-orange-600 text-sm ml-1 font-semibold">
                Trending
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer backgroundColor="#f9fafb" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      {/* Header */}
      <View className="bg-white px-6 pt-6 pb-4">
        <View className="flex-row items-center mb-4">
          <LinearGradient
            colors={['#f97316', '#ef4444']}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name="flame" size={24} color="white" />
          </LinearGradient>
          <View>
            <Text className="text-3xl font-black text-gray-900">
              Trending
            </Text>
            <Text className="text-sm text-gray-500">
              What's hot right now
            </Text>
          </View>
        </View>

        {/* Category Filters */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingRight: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedCategory(item.id)}
              activeOpacity={0.7}
              style={{
                marginRight: 8,
              }}
            >
              <LinearGradient
                colors={
                  selectedCategory === item.id
                    ? ['#3b82f6', '#8b5cf6']
                    : ['#f3f4f6', '#e5e7eb']
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                }}
              >
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={selectedCategory === item.id ? 'white' : '#4b5563'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  className={`font-semibold text-sm ${
                    selectedCategory === item.id
                      ? 'text-white'
                      : 'text-gray-700'
                  }`}
                >
                  {item.label}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Trending Videos List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-gray-500 mt-4">Loading trending videos...</Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderTrendingCard}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="flame-outline" size={64} color="#cbd5e1" />
              <Text className="text-gray-500 mt-4 text-center px-8">
                No trending videos at the moment
              </Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}