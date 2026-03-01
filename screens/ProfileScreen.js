import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  FlatList,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import ScreenContainer from '../components/ScreenContainer';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 3;

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('videos');

  const stats = [
    { label: 'Videos', value: '24', icon: 'videocam', color: '#3b82f6' },
    { label: 'Followers', value: '1.2K', icon: 'people', color: '#8b5cf6' },
    { label: 'Following', value: '342', icon: 'person-add', color: '#ec4899' },
  ];

  const menuItems = [
    {
      id: 1,
      title: 'Edit Profile',
      subtitle: 'Update your information',
      icon: 'person-circle',
      color: '#3b82f6',
      onPress: () => Alert.alert('Coming Soon', 'Edit profile feature'),
    },
    {
      id: 2,
      title: 'My Videos',
      subtitle: 'View your uploaded content',
      icon: 'film',
      color: '#8b5cf6',
      onPress: () => setActiveTab('videos'),
    },
    {
      id: 3,
      title: 'Saved Videos',
      subtitle: 'Your bookmarked content',
      icon: 'bookmark',
      color: '#f59e0b',
      onPress: () => setActiveTab('saved'),
    },
    {
      id: 4,
      title: 'Settings',
      subtitle: 'App preferences and privacy',
      icon: 'settings',
      color: '#6b7280',
      onPress: () => Alert.alert('Coming Soon', 'Settings feature'),
    },
    {
      id: 5,
      title: 'Help & Support',
      subtitle: 'Get help or report issues',
      icon: 'help-circle',
      color: '#10b981',
      onPress: () => Alert.alert('Coming Soon', 'Help & support feature'),
    },
  ];

  // Mock video data for demonstration
  const myVideos = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    title: `My Video ${i + 1}`,
    thumbnail: `https://picsum.photos/seed/${i}/400/600`,
    views: Math.floor(Math.random() * 50000) + 1000,
    duration: Math.floor(Math.random() * 180) + 30,
    video_files: [{
      link: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    }],
    user: {
      name: user?.fullName || user?.username || 'You'
    },
    description: 'One of my amazing videos!',
  }));

  const savedVideos = Array.from({ length: 8 }, (_, i) => ({
    id: i + 100,
    title: `Saved Video ${i + 1}`,
    thumbnail: `https://picsum.photos/seed/${i + 100}/400/600`,
    views: Math.floor(Math.random() * 100000) + 5000,
    duration: Math.floor(Math.random() * 240) + 45,
    video_files: [{
      link: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
    }],
    user: {
      name: 'Content Creator'
    },
    description: 'A saved video from my collection',
  }));

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            // Navigation handled automatically by AuthContext
          },
        },
      ]
    );
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const renderVideoCard = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => navigation.navigate('VideoPlayer', { video: item })}
      style={{
        width: CARD_WIDTH,
        height: CARD_WIDTH * 1.6,
        marginBottom: 6,
      }}
    >
      <View className="bg-gray-200 rounded-xl overflow-hidden" style={{ flex: 1 }}>
        {/* Mock thumbnail */}
        <View className="flex-1 bg-gradient-to-b from-blue-400 to-purple-400 items-center justify-center">
          <Ionicons name="play-circle" size={40} color="white" />
        </View>
        
        {/* Overlay info */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 6,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Ionicons name="eye" size={12} color="white" />
              <Text className="text-white text-xs ml-1 font-semibold">
                {formatNumber(item.views)}
              </Text>
            </View>
            <View className="bg-black/70 px-2 py-0.5 rounded">
              <Text className="text-white text-xs font-semibold">
                {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer backgroundColor="#f9fafb" edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#3b82f6" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with Gradient */}
        <LinearGradient
          colors={['#3b82f6', '#8b5cf6']}
          style={{
            paddingTop: 60,
            paddingBottom: 120,
            paddingHorizontal: 24,
          }}
        >
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-white text-3xl font-black">
              Profile
            </Text>
            <TouchableOpacity
              onPress={() => Alert.alert('Coming Soon', 'Notifications feature')}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
            >
              <Ionicons name="notifications" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Profile Card */}
        <View className="px-6" style={{ marginTop: -80 }}>
          <View className="bg-white rounded-3xl p-6 shadow-lg">
            {/* Avatar and Name */}
            <View className="items-center mb-6">
              <LinearGradient
                colors={['#3b82f6', '#8b5cf6']}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Text className="text-white text-4xl font-bold">
                  {user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                </Text>
              </LinearGradient>

              <Text className="text-gray-900 text-2xl font-bold mb-1">
                {user?.fullName || 'User'}
              </Text>
              <Text className="text-gray-500 text-base mb-1">
                @{user?.username || 'username'}
              </Text>
              <View className="flex-row items-center mt-2">
                <Ionicons name="mail" size={14} color="#94a3b8" />
                <Text className="text-gray-500 text-sm ml-2">
                  {user?.email}
                </Text>
              </View>
              <View className="flex-row items-center mt-1">
                <Ionicons name="location" size={14} color="#94a3b8" />
                <Text className="text-gray-500 text-sm ml-2">
                  {user?.country || 'Unknown'}
                </Text>
              </View>
            </View>

            {/* Stats */}
            <View className="flex-row justify-around mb-6">
              {stats.map((stat, index) => (
                <View key={index} className="items-center">
                  <View
                    className="w-14 h-14 rounded-full items-center justify-center mb-2"
                    style={{ backgroundColor: `${stat.color}15` }}
                  >
                    <Ionicons name={stat.icon} size={24} color={stat.color} />
                  </View>
                  <Text className="text-gray-900 font-bold text-xl mb-1">
                    {stat.value}
                  </Text>
                  <Text className="text-gray-500 text-sm">
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Edit Profile Button */}
            <TouchableOpacity
              onPress={() => Alert.alert('Coming Soon', 'Edit profile feature')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3b82f6', '#8b5cf6']}
                style={{
                  borderRadius: 16,
                  padding: 16,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="create" size={20} color="white" />
                <Text className="text-white font-bold text-base ml-2">
                  Edit Profile
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Tabs for Videos */}
          <View className="bg-white rounded-3xl mt-6 p-6 shadow-lg">
            <View className="flex-row border-b border-gray-200 mb-4">
              <TouchableOpacity
                onPress={() => setActiveTab('videos')}
                className={`flex-1 py-3 ${
                  activeTab === 'videos' ? 'border-b-2 border-blue-600' : ''
                }`}
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons
                    name="grid"
                    size={20}
                    color={activeTab === 'videos' ? '#3b82f6' : '#94a3b8'}
                  />
                  <Text
                    className={`ml-2 font-semibold ${
                      activeTab === 'videos' ? 'text-blue-600' : 'text-gray-500'
                    }`}
                  >
                    My Videos
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('saved')}
                className={`flex-1 py-3 ${
                  activeTab === 'saved' ? 'border-b-2 border-blue-600' : ''
                }`}
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons
                    name="bookmark"
                    size={20}
                    color={activeTab === 'saved' ? '#3b82f6' : '#94a3b8'}
                  />
                  <Text
                    className={`ml-2 font-semibold ${
                      activeTab === 'saved' ? 'text-blue-600' : 'text-gray-500'
                    }`}
                  >
                    Saved
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Videos Grid */}
            <FlatList
              data={activeTab === 'videos' ? myVideos : savedVideos}
              keyExtractor={(item) => item.id.toString()}
              numColumns={3}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              renderItem={renderVideoCard}
              scrollEnabled={false}
              ListEmptyComponent={
                <View className="items-center py-12">
                  <Ionicons
                    name={activeTab === 'videos' ? 'videocam-outline' : 'bookmark-outline'}
                    size={64}
                    color="#cbd5e1"
                  />
                  <Text className="text-gray-500 mt-4 text-center">
                    {activeTab === 'videos'
                      ? 'No videos yet. Start uploading!'
                      : 'No saved videos yet'}
                  </Text>
                </View>
              }
            />
          </View>

          {/* Menu Items */}
          <View className="mt-6 mb-8">
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={item.onPress}
                activeOpacity={0.7}
                className="bg-white rounded-2xl p-5 mb-3 shadow-sm flex-row items-center"
              >
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-4"
                  style={{ backgroundColor: `${item.color}15` }}
                >
                  <Ionicons name={item.icon} size={24} color={item.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-bold text-base mb-1">
                    {item.title}
                  </Text>
                  <Text className="text-gray-500 text-sm">
                    {item.subtitle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            ))}

            {/* Logout Button */}
            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.7}
              className="bg-red-50 rounded-2xl p-5 mt-4 shadow-sm flex-row items-center"
            >
              <View className="w-12 h-12 bg-red-100 rounded-full items-center justify-center mr-4">
                <Ionicons name="log-out" size={24} color="#ef4444" />
              </View>
              <View className="flex-1">
                <Text className="text-red-600 font-bold text-base mb-1">
                  Logout
                </Text>
                <Text className="text-red-400 text-sm">
                  Sign out of your account
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fca5a5" />
            </TouchableOpacity>
          </View>

          {/* App Info */}
          <View className="bg-white rounded-2xl p-5 mb-8">
            <Text className="text-center text-gray-500 text-sm mb-2">
              TrueVision v1.0.0
            </Text>
            <Text className="text-center text-gray-400 text-xs">
              Authentic Content Platform
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}