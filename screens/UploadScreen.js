import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ScreenContainer from '../components/ScreenContainer';

export default function UploadScreen({ navigation }) {
  const [videoUri, setVideoUri] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [uploading, setUploading] = useState(false);

  const categories = [
    { id: 'nature', label: 'Nature', icon: 'leaf', color: '#10b981' },
    { id: 'tech', label: 'Technology', icon: 'hardware-chip', color: '#3b82f6' },
    { id: 'people', label: 'People', icon: 'people', color: '#f59e0b' },
    { id: 'education', label: 'Educational', icon: 'school', color: '#8b5cf6' },
    { id: 'entertainment', label: 'Entertainment', icon: 'musical-notes', color: '#ec4899' },
    { id: 'sports', label: 'Sports', icon: 'football', color: '#ef4444' },
  ];

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant camera roll permissions to upload videos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 1,
      });

      if (!result.canceled) {
        setVideoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  const recordVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant camera permissions to record videos.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 1,
        videoMaxDuration: 60,
      });

      if (!result.canceled) {
        setVideoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video');
    }
  };

  const handleUpload = () => {
    if (!videoUri) {
      Alert.alert('No Video', 'Please select or record a video first');
      return;
    }

    if (!title.trim()) {
      Alert.alert('No Title', 'Please enter a title for your video');
      return;
    }

    if (!category) {
      Alert.alert('No Category', 'Please select a category');
      return;
    }

    // Here you would implement the actual upload logic
    setUploading(true);
    
    // Simulate upload
    setTimeout(() => {
      setUploading(false);
      Alert.alert(
        'Success!',
        'Your video has been uploaded successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              setVideoUri(null);
              setTitle('');
              setDescription('');
              setCategory('');
              navigation.navigate('Home');
            },
          },
        ]
      );
    }, 2000);
  };

  return (
    <ScreenContainer backgroundColor="#f9fafb" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-white px-6 pt-6 pb-4">
          <View className="flex-row items-center mb-4">
            <LinearGradient
              colors={['#3b82f6', '#8b5cf6']}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="cloud-upload" size={24} color="white" />
            </LinearGradient>
            <View>
              <Text className="text-3xl font-black text-gray-900">
                Upload
              </Text>
              <Text className="text-sm text-gray-500">
                Share your authentic content
              </Text>
            </View>
          </View>
        </View>

        <View className="px-6 py-6">
          {/* Video Preview / Upload Options */}
          {!videoUri ? (
            <View className="mb-6">
              <Text className="text-lg font-bold text-gray-900 mb-4">
                Select Video
              </Text>

              <TouchableOpacity
                onPress={pickVideo}
                activeOpacity={0.8}
                className="bg-white rounded-3xl p-8 mb-4 shadow-sm"
              >
                <LinearGradient
                  colors={['#3b82f6', '#8b5cf6']}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Ionicons name="folder-open" size={40} color="white" />
                </LinearGradient>
                <Text className="text-gray-900 font-bold text-xl text-center mb-2">
                  Choose from Gallery
                </Text>
                <Text className="text-gray-500 text-center text-sm">
                  Select a video from your device
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={recordVideo}
                activeOpacity={0.8}
                className="bg-white rounded-3xl p-8 shadow-sm"
              >
                <LinearGradient
                  colors={['#ef4444', '#ec4899']}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Ionicons name="videocam" size={40} color="white" />
                </LinearGradient>
                <Text className="text-gray-900 font-bold text-xl text-center mb-2">
                  Record Video
                </Text>
                <Text className="text-gray-500 text-center text-sm">
                  Record a new video now
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Video Preview */}
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-lg font-bold text-gray-900">
                    Video Preview
                  </Text>
                  <TouchableOpacity
                    onPress={() => setVideoUri(null)}
                    className="bg-red-100 px-3 py-1 rounded-lg"
                  >
                    <Text className="text-red-600 font-semibold text-sm">
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
                <View className="bg-gray-900 rounded-3xl overflow-hidden" style={{ height: 400 }}>
                  <View className="flex-1 items-center justify-center">
                    <Ionicons name="play-circle" size={64} color="white" />
                    <Text className="text-white mt-4">Video Selected</Text>
                  </View>
                </View>
              </View>

              {/* Video Details */}
              <View className="mb-6">
                <Text className="text-lg font-bold text-gray-900 mb-4">
                  Video Details
                </Text>

                {/* Title */}
                <View className="mb-4">
                  <Text className="text-gray-700 font-semibold mb-2">
                    Title *
                  </Text>
                  <TextInput
                    placeholder="Give your video a catchy title"
                    placeholderTextColor="#94a3b8"
                    value={title}
                    onChangeText={setTitle}
                    className="bg-white px-4 py-4 rounded-2xl text-gray-900 text-base"
                    maxLength={100}
                  />
                </View>

                {/* Description */}
                <View className="mb-4">
                  <Text className="text-gray-700 font-semibold mb-2">
                    Description
                  </Text>
                  <TextInput
                    placeholder="Tell viewers about your video"
                    placeholderTextColor="#94a3b8"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    className="bg-white px-4 py-4 rounded-2xl text-gray-900 text-base"
                    maxLength={500}
                    textAlignVertical="top"
                  />
                </View>

                {/* Category */}
                <View className="mb-6">
                  <Text className="text-gray-700 font-semibold mb-3">
                    Category *
                  </Text>
                  <View className="flex-row flex-wrap">
                    {categories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setCategory(cat.id)}
                        activeOpacity={0.7}
                        className={`mr-3 mb-3 px-4 py-3 rounded-2xl flex-row items-center ${
                          category === cat.id ? 'bg-blue-600' : 'bg-white'
                        }`}
                      >
                        <Ionicons
                          name={cat.icon}
                          size={18}
                          color={category === cat.id ? 'white' : cat.color}
                        />
                        <Text
                          className={`ml-2 font-semibold ${
                            category === cat.id ? 'text-white' : 'text-gray-700'
                          }`}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Upload Button */}
              <TouchableOpacity
                onPress={handleUpload}
                disabled={uploading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={uploading ? ['#64748b', '#475569'] : ['#3b82f6', '#8b5cf6']}
                  style={{
                    borderRadius: 24,
                    padding: 20,
                    alignItems: 'center',
                    shadowColor: '#3b82f6',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                >
                  <View className="flex-row items-center">
                    {uploading ? (
                      <>
                        <Ionicons name="hourglass" size={24} color="white" />
                        <Text className="text-white font-bold text-lg ml-3">
                          Uploading...
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={24} color="white" />
                        <Text className="text-white font-bold text-lg ml-3">
                          Upload Video
                        </Text>
                      </>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}