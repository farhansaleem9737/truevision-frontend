import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  RefreshControl,
  Animated,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import ScreenContainer from '../components/ScreenContainer';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Stories data
  const stories = [
    { id: 1, username: 'sahiladeem_', image: 'https://i.pravatar.cc/150?img=1', viewed: false },
    { id: 2, username: 'youthclubpk', image: 'https://i.pravatar.cc/150?img=2', viewed: false },
    { id: 3, username: 'techinsider', image: 'https://i.pravatar.cc/150?img=3', viewed: true },
    { id: 4, username: 'naturelover', image: 'https://i.pravatar.cc/150?img=4', viewed: false },
    { id: 5, username: 'foodie', image: 'https://i.pravatar.cc/150?img=5', viewed: false },
    { id: 6, username: 'travelgram', image: 'https://i.pravatar.cc/150?img=6', viewed: true },
    { id: 7, username: 'fitness', image: 'https://i.pravatar.cc/150?img=7', viewed: false },
  ];

  // Posts data - matching the Instagram style
  const posts = [
    {
      id: 1,
      username: 'youthclubpk',
      userImage: 'https://i.pravatar.cc/150?img=2',
      location: 'Pakistan',
      timeAgo: '19 minutes ago',
      content: 'A honeybee can prepare 1/12th... more',
      likes: 132,
      comments: 6,
      hasLiked: false,
      hasSaved: false,
      image: 'https://picsum.photos/seed/bee/800/1000',
      caption: 'jese Rabi\'ah bin \'Amr',
    },
    {
      id: 2,
      username: 'enginepakistan',
      userImage: 'https://i.pravatar.cc/150?img=8',
      location: 'Karachi',
      timeAgo: '45 minutes ago',
      content: 'New engine prototype testing...',
      likes: 89,
      comments: 12,
      hasLiked: true,
      hasSaved: false,
      image: 'https://picsum.photos/seed/engine/800/1000',
      caption: 'Engineering marvel 🇵🇰',
    },
    {
      id: 3,
      username: 'techinsider',
      userImage: 'https://i.pravatar.cc/150?img=3',
      location: 'Silicon Valley',
      timeAgo: '2 hours ago',
      content: 'Breaking: New AI breakthrough...',
      likes: 245,
      comments: 23,
      hasLiked: false,
      hasSaved: true,
      image: 'https://picsum.photos/seed/tech/800/1000',
      caption: 'The future is here 🚀',
    },
  ];

  // State for post interactions
  const [postsState, setPostsState] = useState(posts);

  const handleLike = (postId) => {
    setPostsState(prevPosts =>
      prevPosts.map(post =>
        post.id === postId
          ? { 
              ...post, 
              hasLiked: !post.hasLiked,
              likes: post.hasLiked ? post.likes - 1 : post.likes + 1
            }
          : post
      )
    );
  };

  const handleSave = (postId) => {
    setPostsState(prevPosts =>
      prevPosts.map(post =>
        post.id === postId
          ? { ...post, hasSaved: !post.hasSaved }
          : post
      )
    );
  };

  const Header = () => (
    <View className="bg-white">
      <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">TrueVision</Text>
        <View className="flex-row space-x-4">
          <TouchableOpacity>
            <Ionicons name="heart-outline" size={24} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="paper-plane-outline" size={24} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const StoriesBar = () => (
    <View className="bg-white py-3 border-b border-gray-200">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12 }}
      >
        {/* Your Story */}
        <TouchableOpacity className="items-center mr-4">
          <View className="relative">
            <View className="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-300 items-center justify-center">
              <Text className="text-2xl text-gray-600">
                {user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'U'}
              </Text>
            </View>
            <View className="absolute bottom-0 right-0 bg-blue-500 rounded-full w-5 h-5 items-center justify-center border-2 border-white">
              <Ionicons name="add" size={14} color="white" />
            </View>
          </View>
          <Text className="text-xs mt-1 text-gray-700">Your story</Text>
        </TouchableOpacity>

        {/* Other Stories */}
        {stories.map((story) => (
          <TouchableOpacity key={story.id} className="items-center mr-4">
            <LinearGradient
              colors={story.viewed ? ['#9ca3af', '#6b7280'] : ['#f59e0b', '#ef4444', '#ec4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{ padding: 2 }}
            >
              <View className="w-14 h-14 rounded-full bg-white items-center justify-center">
                <Image
                  source={{ uri: story.image }}
                  className="w-14 h-14 rounded-full"
                />
              </View>
            </LinearGradient>
            <Text className="text-xs mt-1 text-gray-700" numberOfLines={1}>
              {story.username}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const Post = ({ post }) => (
    <View className="mb-4 bg-white">
      {/* Post Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center">
          <Image
            source={{ uri: post.userImage }}
            className="w-8 h-8 rounded-full"
          />
          <View className="ml-3">
            <View className="flex-row items-center">
              <Text className="font-semibold text-gray-900">{post.username}</Text>
              {post.location && (
                <>
                  <Text className="text-gray-600 mx-1">•</Text>
                  <Text className="text-gray-600 text-sm">{post.location}</Text>
                </>
              )}
            </View>
            <Text className="text-xs text-gray-500">{post.timeAgo}</Text>
          </View>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={20} color="#4b5563" />
        </TouchableOpacity>
      </View>

      {/* Post Image */}
      <Image
        source={{ uri: post.image }}
        className="w-full h-96"
        resizeMode="cover"
      />

      {/* Post Actions */}
      <View className="px-4 py-3">
        <View className="flex-row justify-between mb-3">
          <View className="flex-row space-x-4">
            <TouchableOpacity onPress={() => handleLike(post.id)}>
              <Ionicons
                name={post.hasLiked ? "heart" : "heart-outline"}
                size={26}
                color={post.hasLiked ? "#ef4444" : "#111827"}
              />
            </TouchableOpacity>
            <TouchableOpacity>
              <Ionicons name="chatbubble-outline" size={24} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity>
              <Ionicons name="paper-plane-outline" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => handleSave(post.id)}>
            <Ionicons
              name={post.hasSaved ? "bookmark" : "bookmark-outline"}
              size={24}
              color={post.hasSaved ? "#3b82f6" : "#111827"}
            />
          </TouchableOpacity>
        </View>

        {/* Likes */}
        <Text className="font-semibold text-gray-900 mb-1">
          {post.likes.toLocaleString()} likes
        </Text>

        {/* Caption */}
        <View className="flex-row flex-wrap mb-1">
          <Text className="font-semibold text-gray-900 mr-2">{post.username}</Text>
          <Text className="text-gray-800">{post.caption}</Text>
        </View>

        {/* View Comments */}
        {post.comments > 0 && (
          <TouchableOpacity>
            <Text className="text-gray-500 text-sm">
              View all {post.comments} comments
            </Text>
          </TouchableOpacity>
        )}

        {/* Add Comment */}
        <View className="flex-row items-center mt-2 pt-2 border-t border-gray-100">
          <Ionicons name="happy-outline" size={20} color="#9ca3af" />
          <Text className="text-gray-400 text-sm ml-3 flex-1">
            Add a comment...
          </Text>
          <View className="flex-row space-x-2">
            <Ionicons name="heart-outline" size={18} color="#9ca3af" />
            <Ionicons name="add-circle-outline" size={18} color="#9ca3af" />
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer backgroundColor="#ffffff" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <Header />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
      >
        <StoriesBar />
        
        {/* Posts */}
        {postsState.map((post) => (
          <Post key={post.id} post={post} />
        ))}

        {/* Loading More Indicator */}
        <View className="py-8 items-center">
          <View className="flex-row space-x-2">
            <View className="w-2 h-2 bg-gray-300 rounded-full" />
            <View className="w-2 h-2 bg-gray-300 rounded-full" />
            <View className="w-2 h-2 bg-gray-300 rounded-full" />
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}