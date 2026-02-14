import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();

  const stats = [
    { label: 'Videos', value: '0', icon: 'videocam', color: '#3b82f6' },
    { label: 'Followers', value: '0', icon: 'people', color: '#8b5cf6' },
    { label: 'Following', value: '0', icon: 'person-add', color: '#ec4899' },
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
      onPress: () => Alert.alert('Coming Soon', 'My videos feature'),
    },
    {
      id: 3,
      title: 'Saved Videos',
      subtitle: 'Your bookmarked content',
      icon: 'bookmark',
      color: '#f59e0b',
      onPress: () => Alert.alert('Coming Soon', 'Saved videos feature'),
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

  return (
    <View className="flex-1 bg-gray-50">
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
    </View>
  );
}