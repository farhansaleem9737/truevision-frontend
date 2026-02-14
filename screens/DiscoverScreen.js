import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import pexelsService from '../services/pexelsService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function DiscoverScreen({ navigation, route }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(route?.params?.category || 'nature');
  const [page, setPage] = useState(1);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const filters = [
    { id: 'all', label: 'All', query: 'nature' },
    { id: 'nature', label: 'Nature', query: 'nature' },
    { id: 'tech', label: 'Technology', query: 'technology' },
    { id: 'people', label: 'People', query: 'people' },
    { id: 'animals', label: 'Animals', query: 'animals' },
    { id: 'food', label: 'Food', query: 'food' },
    { id: 'travel', label: 'Travel', query: 'travel' },
    { id: 'sports', label: 'Sports', query: 'sports' },
    { id: 'music', label: 'Music', query: 'music' },
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
      // Fallback mock data if API fails
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

  const getMockVideos = () => {
    // Fallback mock data
    return Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      user: {
        name: `Creator ${i + 1}`,
      },
      video_files: [{
        link: 'https://player.vimeo.com/external/xxx.mp4',
        quality: 'hd',
      }],
      video_pictures: [{
        picture: `https://images.pexels.com/videos/${1000 + i}/free-video-${1000 + i}.jpg`,
      }],
      duration: 15 + (i * 5),
      width: 1920,
      height: 1080,
    }));
  };

  const renderVideoCard = ({ item, index }) => {
    const thumbnail = item.video_pictures?.[0]?.picture || item.image;
    const duration = item.duration ? Math.floor(item.duration) : 0;
    const creator = item.user?.name || 'Unknown';

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('VideoPlayer', { video: item })}
        style={{
          width: CARD_WIDTH,
          marginLeft: index % 2 === 0 ? 0 : 12,
          marginBottom: 12,
        }}
      >
        <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {/* Thumbnail */}
          <View style={{ height: CARD_WIDTH * 1.4, position: 'relative' }}>
            <Image
              source={{ uri: thumbnail }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
            
            {/* Duration Badge */}
            <View
              className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded-lg"
            >
              <Text className="text-white text-xs font-semibold">
                {duration}s
              </Text>
            </View>

            {/* Play Icon */}
            <View
              className="absolute inset-0 items-center justify-center"
            >
              <View className="w-14 h-14 bg-white/30 rounded-full items-center justify-center">
                <Ionicons name="play" size={24} color="white" />
              </View>
            </View>
          </View>

          {/* Info */}
          <View className="p-3">
            <Text className="text-gray-900 font-semibold text-sm mb-1" numberOfLines={2}>
              {item.title || `Video by ${creator}`}
            </Text>
            <View className="flex-row items-center">
              <Ionicons name="person-circle" size={14} color="#94a3b8" />
              <Text className="text-gray-500 text-xs ml-1" numberOfLines={1}>
                {creator}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      {/* Header */}
      <View className="bg-white px-6 pt-6 pb-4">
        <Text className="text-3xl font-black text-gray-900 mb-4">
          Discover
        </Text>

        {/* Search Bar */}
        <View className="flex-row items-center bg-gray-100 rounded-2xl px-4 py-3 mb-4">
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            placeholder="Search videos..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            className="flex-1 text-gray-900 text-base ml-2"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

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
              activeOpacity={0.7}
              className={`px-5 py-2 rounded-full mr-2 ${
                selectedFilter === item.id
                  ? 'bg-blue-600'
                  : 'bg-gray-200'
              }`}
            >
              <Text
                className={`font-semibold text-sm ${
                  selectedFilter === item.id
                    ? 'text-white'
                    : 'text-gray-700'
                }`}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Videos Grid */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-gray-500 mt-4">Loading videos...</Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 24 }}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
          renderItem={renderVideoCard}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="videocam-off" size={64} color="#cbd5e1" />
              <Text className="text-gray-500 mt-4 text-center px-8">
                No videos found. Try a different search term.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}