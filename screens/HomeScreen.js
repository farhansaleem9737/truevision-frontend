import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => setRefreshing(false), 1000);
  };

  const categories = [
    { id: 1, name: 'Nature', icon: 'leaf', color: '#10b981', query: 'nature' },
    { id: 2, name: 'Technology', icon: 'hardware-chip', color: '#3b82f6', query: 'technology' },
    { id: 3, name: 'People', icon: 'people', color: '#f59e0b', query: 'people' },
    { id: 4, name: 'Animals', icon: 'paw', color: '#8b5cf6', query: 'animals' },
    { id: 5, name: 'Food', icon: 'fast-food', color: '#ef4444', query: 'food' },
    { id: 6, name: 'Travel', icon: 'airplane', color: '#06b6d4', query: 'travel' },
  ];

  const featuredContent = [
    {
      id: 1,
      title: 'Discover Amazing Videos',
      subtitle: 'Explore curated content',
      gradient: ['#667eea', '#764ba2'],
      icon: 'videocam',
    },
    {
      id: 2,
      title: 'Trending Now',
      subtitle: 'What\'s hot today',
      gradient: ['#f093fb', '#f5576c'],
      icon: 'flame',
    },
    {
      id: 3,
      title: 'Educational',
      subtitle: 'Learn something new',
      gradient: ['#4facfe', '#00f2fe'],
      icon: 'school',
    },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="px-6 pt-6 pb-4 bg-white">
          <View className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-3xl font-black text-gray-900">
                TrueVision
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                Authentic Content Platform
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full items-center justify-center"
            >
              <LinearGradient
                colors={['#3b82f6', '#8b5cf6']}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text className="text-white text-lg font-bold">
                  {user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Welcome Card */}
          <View className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl p-5 mb-4">
            <LinearGradient
              colors={['#3b82f6', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                padding: 20,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-white text-xl font-bold mb-1">
                    Welcome back, {user?.fullName?.split(' ')[0] || user?.username || 'User'}! 👋
                  </Text>
                  <Text className="text-blue-100 text-sm">
                    Discover amazing authentic videos today
                  </Text>
                </View>
                <Ionicons name="rocket" size={40} color="white" />
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Featured Content */}
        <View className="px-6 py-4">
          <Text className="text-xl font-bold text-gray-900 mb-4">
            Featured Collections
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 24 }}
          >
            {featuredContent.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => navigation.navigate('Discover')}
                activeOpacity={0.8}
                style={{ marginRight: 16 }}
              >
                <LinearGradient
                  colors={item.gradient}
                  style={{
                    width: width * 0.7,
                    height: 160,
                    borderRadius: 20,
                    padding: 20,
                    justifyContent: 'space-between',
                  }}
                >
                  <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center">
                    <Ionicons name={item.icon} size={24} color="white" />
                  </View>
                  <View>
                    <Text className="text-white text-2xl font-bold mb-1">
                      {item.title}
                    </Text>
                    <Text className="text-white/80 text-sm">
                      {item.subtitle}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Categories */}
        <View className="px-6 py-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-gray-900">
              Browse Categories
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Discover')}>
              <Text className="text-blue-600 font-semibold">See All</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row flex-wrap justify-between">
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                onPress={() => navigation.navigate('Discover', { category: category.query })}
                activeOpacity={0.7}
                className="bg-white rounded-2xl p-4 mb-4 shadow-sm"
                style={{ width: (width - 60) / 2 }}
              >
                <View
                  className="w-14 h-14 rounded-full items-center justify-center mb-3"
                  style={{ backgroundColor: `${category.color}15` }}
                >
                  <Ionicons
                    name={category.icon}
                    size={28}
                    color={category.color}
                  />
                </View>
                <Text className="text-gray-900 font-bold text-base mb-1">
                  {category.name}
                </Text>
                <Text className="text-gray-500 text-xs">
                  Explore videos
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-6 py-4 mb-8">
          <Text className="text-xl font-bold text-gray-900 mb-4">
            Quick Actions
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('Upload')}
            activeOpacity={0.8}
            className="bg-white rounded-2xl p-5 mb-3 shadow-sm flex-row items-center"
          >
            <View className="w-14 h-14 bg-blue-100 rounded-full items-center justify-center mr-4">
              <Ionicons name="cloud-upload" size={28} color="#3b82f6" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-bold text-base mb-1">
                Upload Video
              </Text>
              <Text className="text-gray-500 text-sm">
                Share your authentic content
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Trending')}
            activeOpacity={0.8}
            className="bg-white rounded-2xl p-5 mb-3 shadow-sm flex-row items-center"
          >
            <View className="w-14 h-14 bg-orange-100 rounded-full items-center justify-center mr-4">
              <Ionicons name="flame" size={28} color="#f97316" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-bold text-base mb-1">
                Trending Videos
              </Text>
              <Text className="text-gray-500 text-sm">
                See what's popular now
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#cbd5e1" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}