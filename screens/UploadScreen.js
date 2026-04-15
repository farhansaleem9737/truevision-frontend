// truevision/screens/UploadScreen.js
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StatusBar, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { Ionicons }        from '@expo/vector-icons';
import * as ImagePicker    from 'expo-image-picker';
import ScreenContainer     from '../components/ScreenContainer';
import videoService        from '../services/VideoService';

// ── Categories matching the backend enum ─────────────────────────────────────
const CATEGORIES = [
  { id: 'entertainment', label: 'Entertainment', icon: 'film',           color: '#ec4899' },
  { id: 'music',         label: 'Music',         icon: 'musical-notes',  color: '#8b5cf6' },
  { id: 'sports',        label: 'Sports',        icon: 'football',       color: '#ef4444' },
  { id: 'gaming',        label: 'Gaming',        icon: 'game-controller',color: '#06b6d4' },
  { id: 'education',     label: 'Education',     icon: 'school',         color: '#8b5cf6' },
  { id: 'tech',          label: 'Technology',    icon: 'hardware-chip',  color: '#3b82f6' },
  { id: 'food',          label: 'Food',          icon: 'restaurant',     color: '#f97316' },
  { id: 'travel',        label: 'Travel',        icon: 'airplane',       color: '#10b981' },
  { id: 'fashion',       label: 'Fashion',       icon: 'shirt',          color: '#f59e0b' },
  { id: 'other',         label: 'Other',         icon: 'apps',           color: '#6b7280' },
];

const VISIBILITY = [
  { id: 'public',    label: 'Public',    icon: 'globe-outline'  },
  { id: 'followers', label: 'Followers', icon: 'people-outline' },
  { id: 'private',   label: 'Private',   icon: 'lock-closed-outline' },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function UploadScreen({ navigation }) {
  const [videoAsset,   setVideoAsset]   = useState(null);
  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [tags,         setTags]         = useState('');
  const [song,         setSong]         = useState('');
  const [category,     setCategory]     = useState('');
  const [visibility,   setVisibility]   = useState('public');
  const [allowDownload, setAllowDownload] = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const [progress,     setProgress]     = useState(0);

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant media library permissions to upload videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType?.Medium ?? 0.5,
    });
    if (!result.canceled) setVideoAsset(result.assets[0]);
  };

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera permissions to record videos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType?.Medium ?? 0.5,
      videoMaxDuration: 300,
    });
    if (!result.canceled) setVideoAsset(result.assets[0]);
  };

  const handleUpload = async () => {
    if (!videoAsset) return Alert.alert('No Video', 'Please select or record a video first.');
    if (!title.trim()) return Alert.alert('Title Required', 'Please enter a title for your video.');
    if (!category)     return Alert.alert('Category Required', 'Please choose a category.');

    setUploading(true);
    setProgress(0);

    const metadata = {
      title:        title.trim(),
      description:  description.trim(),
      tags:         tags.trim(),
      song:         song.trim(),
      category,
      visibility,
      allowDownload,                             // boolean — NOT String()
      mimeType:     videoAsset.mimeType || 'video/mp4', // real MIME type for Cloudinary
    };

    const res = await videoService.uploadVideo(
      videoAsset.uri,
      metadata,
      (pct) => setProgress(pct),
    );

    setUploading(false);
    setProgress(0);

    if (res.success) {
      Alert.alert(
        'Uploaded!',
        'Your video has been uploaded and will appear in the feed shortly.',
        [{
          text: 'Great!',
          onPress: () => {
            setVideoAsset(null); setTitle(''); setDescription('');
            setTags(''); setSong(''); setCategory(''); setVisibility('public');
            setAllowDownload(true);
            navigation.navigate('Profile');
          },
        }],
      );
    } else {
      // Show the full message — it contains the step prefix so the user knows exactly what failed
      Alert.alert('Upload Failed', res.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <ScreenContainer backgroundColor="#f9fafb" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ backgroundColor: 'white', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <LinearGradient colors={['#3b82f6', '#8b5cf6']} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Ionicons name="cloud-upload" size={24} color="white" />
            </LinearGradient>
            <View>
              <Text style={{ fontSize: 26, fontWeight: '900', color: '#0f172a' }}>Upload</Text>
              <Text style={{ fontSize: 13, color: '#64748b' }}>Share your authentic content</Text>
            </View>
          </View>

          {/* Constraints note */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, marginTop: 14 }}>
            <Ionicons name="information-circle" size={18} color="#3b82f6" style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12, color: '#1e40af', lineHeight: 18 }}>
              Videos are automatically compressed to max 720p. Multiple quality versions (144p – 720p) are generated. Content violating guidelines will be rejected.
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }}>

          {/* Video picker */}
          {!videoAsset ? (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 14 }}>Select Video</Text>
              <TouchableOpacity onPress={pickVideo} activeOpacity={0.85} style={{ backgroundColor: 'white', borderRadius: 24, padding: 28, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                <LinearGradient colors={['#3b82f6', '#8b5cf6']} style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 }}>
                  <Ionicons name="folder-open" size={36} color="white" />
                </LinearGradient>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 6 }}>Choose from Gallery</Text>
                <Text style={{ color: '#64748b', textAlign: 'center', fontSize: 13 }}>Select a video from your device</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={recordVideo} activeOpacity={0.85} style={{ backgroundColor: 'white', borderRadius: 24, padding: 28, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                <LinearGradient colors={['#ef4444', '#ec4899']} style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 }}>
                  <Ionicons name="videocam" size={36} color="white" />
                </LinearGradient>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 6 }}>Record Video</Text>
                <Text style={{ color: '#64748b', textAlign: 'center', fontSize: 13 }}>Record a new video now (max 5 min)</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Preview */}
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>Video Selected</Text>
                  <TouchableOpacity onPress={() => setVideoAsset(null)} style={{ backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
                    <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>Remove</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ backgroundColor: '#0f172a', borderRadius: 24, height: 180, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {videoAsset.uri ? (
                    <View style={{ alignItems: 'center' }}>
                      <Ionicons name="checkmark-circle" size={52} color="#22c55e" />
                      <Text style={{ color: 'white', marginTop: 10, fontWeight: '700', fontSize: 15 }}>Video ready to upload</Text>
                      {videoAsset.duration && (
                        <Text style={{ color: '#94a3b8', marginTop: 4, fontSize: 12 }}>
                          Duration: {Math.floor(videoAsset.duration / 1000)}s
                        </Text>
                      )}
                      {videoAsset.fileSize && (
                        <Text style={{ color: '#94a3b8', marginTop: 2, fontSize: 12 }}>
                          Size: {(videoAsset.fileSize / (1024 * 1024)).toFixed(1)} MB
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Ionicons name="play-circle" size={52} color="white" />
                  )}
                </View>
              </View>

              {/* Details */}
              <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 16 }}>Video Details</Text>

                {/* Title */}
                <Text style={{ fontWeight: '600', color: '#374151', marginBottom: 6 }}>Title *</Text>
                <TextInput
                  placeholder="Give your video a catchy title"
                  placeholderTextColor="#94a3b8"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={150}
                  style={{ backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: '#0f172a', fontSize: 14, marginBottom: 14, borderWidth: 1.5, borderColor: title ? '#3b82f6' : '#e2e8f0' }}
                />

                {/* Description */}
                <Text style={{ fontWeight: '600', color: '#374151', marginBottom: 6 }}>Description</Text>
                <TextInput
                  placeholder="Tell viewers about your video..."
                  placeholderTextColor="#94a3b8"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  maxLength={2200}
                  textAlignVertical="top"
                  style={{ backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: '#0f172a', fontSize: 14, marginBottom: 14, borderWidth: 1.5, borderColor: '#e2e8f0', minHeight: 90 }}
                />

                {/* Tags */}
                <Text style={{ fontWeight: '600', color: '#374151', marginBottom: 6 }}>Tags</Text>
                <TextInput
                  placeholder="#travel, #food, #vlog"
                  placeholderTextColor="#94a3b8"
                  value={tags}
                  onChangeText={setTags}
                  style={{ backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: '#0f172a', fontSize: 14, marginBottom: 14, borderWidth: 1.5, borderColor: '#e2e8f0' }}
                />

                {/* Song */}
                <Text style={{ fontWeight: '600', color: '#374151', marginBottom: 6 }}>Song / Audio</Text>
                <TextInput
                  placeholder="Original Sound – yourname"
                  placeholderTextColor="#94a3b8"
                  value={song}
                  onChangeText={setSong}
                  style={{ backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: '#0f172a', fontSize: 14, borderWidth: 1.5, borderColor: '#e2e8f0' }}
                />
              </View>

              {/* Category */}
              <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 14 }}>Category *</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setCategory(cat.id)}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        marginRight: 10, marginBottom: 10,
                        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
                        backgroundColor: category === cat.id ? cat.color : '#f3f4f6',
                        borderWidth: 1.5,
                        borderColor: category === cat.id ? cat.color : 'transparent',
                      }}
                    >
                      <Ionicons name={cat.icon} size={15} color={category === cat.id ? 'white' : cat.color} />
                      <Text style={{ marginLeft: 6, fontWeight: '600', fontSize: 13, color: category === cat.id ? 'white' : '#374151' }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Visibility */}
              <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 14 }}>Visibility</Text>
                <View style={{ flexDirection: 'row' }}>
                  {VISIBILITY.map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      onPress={() => setVisibility(v.id)}
                      activeOpacity={0.75}
                      style={{
                        flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, marginRight: v.id !== 'private' ? 8 : 0,
                        backgroundColor: visibility === v.id ? '#3b82f6' : '#f3f4f6',
                      }}
                    >
                      <Ionicons name={v.icon} size={18} color={visibility === v.id ? 'white' : '#6b7280'} />
                      <Text style={{ marginTop: 4, fontSize: 11, fontWeight: '700', color: visibility === v.id ? 'white' : '#374151' }}>{v.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Allow Download toggle */}
              <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                <TouchableOpacity
                  onPress={() => setAllowDownload(d => !d)}
                  activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="download-outline" size={22} color="#3b82f6" style={{ marginRight: 12 }} />
                    <View>
                      <Text style={{ fontWeight: '700', fontSize: 15, color: '#0f172a' }}>Allow Downloads</Text>
                      <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Let viewers download your video</Text>
                    </View>
                  </View>
                  <View style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: allowDownload ? '#3b82f6' : '#e2e8f0', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'white', alignSelf: allowDownload ? 'flex-end' : 'flex-start', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 }} />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Upload button */}
              {uploading ? (
                <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 48 }}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={{ fontWeight: '700', fontSize: 18, color: '#0f172a', marginTop: 14 }}>
                    {progress === 0
                      ? 'Preparing…'
                      : progress < 95
                      ? `Uploading ${progress}%`
                      : 'Saving…'}
                  </Text>

                  {/* Animated progress bar */}
                  <View style={{ width: '100%', height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, marginTop: 16, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.min(progress, 100)}%`, height: '100%', backgroundColor: progress < 95 ? '#3b82f6' : '#22c55e', borderRadius: 4 }} />
                  </View>

                  <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                    {progress < 95
                      ? 'Uploading directly to cloud — keep app open'
                      : 'Finalizing your video record…'}
                  </Text>

                  {/* File size hint */}
                  {videoAsset?.fileSize ? (
                    <Text style={{ color: '#cbd5e1', fontSize: 11, marginTop: 4 }}>
                      File: {(videoAsset.fileSize / (1024 * 1024)).toFixed(1)} MB
                    </Text>
                  ) : null}
                </View>
              ) : (
                <TouchableOpacity onPress={handleUpload} activeOpacity={0.85} style={{ marginBottom: 48 }}>
                  <LinearGradient
                    colors={['#3b82f6', '#8b5cf6']}
                    style={{ borderRadius: 24, padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}
                  >
                    <Ionicons name="cloud-upload" size={24} color="white" />
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 17, marginLeft: 10 }}>Upload Video</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
