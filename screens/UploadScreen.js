// truevision/screens/UploadScreen.js
import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StatusBar, ScrollView,
  TextInput, Alert, ActivityIndicator, Animated, StyleSheet,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { Ionicons }        from '@expo/vector-icons';
import * as ImagePicker    from 'expo-image-picker';
import ScreenContainer     from '../components/ScreenContainer';
import videoService        from '../services/VideoService';
import ContentTypePicker   from '../components/upload/ContentTypePicker';
import SourceUploader      from '../components/upload/SourceUploader';

// ─── Pressable card with subtle scale-on-press feedback ─────────────────────
const PressableCard = ({ onPress, disabled, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handleIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8, tension: 220 }).start();
  };
  const handleOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 200 }).start();
  };
  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onPress}
      onPressIn={handleIn}
      onPressOut={handleOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── Categories matching the backend enum (informative / educational) ─────────
const CATEGORIES = [
  { id: 'education',     label: 'Education',     icon: 'school',          color: '#8b5cf6' },
  { id: 'tech',          label: 'Technology',    icon: 'hardware-chip',   color: '#3b82f6' },
  { id: 'programming',   label: 'Programming',   icon: 'code-slash',      color: '#06b6d4' },
  { id: 'business',      label: 'Business',      icon: 'briefcase',       color: '#0ea5e9' },
  { id: 'finance',       label: 'Finance',       icon: 'cash',            color: '#10b981' },
  { id: 'islamic',       label: 'Islamic',       icon: 'moon',            color: '#059669' },
  { id: 'motivation',    label: 'Motivation',    icon: 'flame',           color: '#f97316' },
  { id: 'news',          label: 'News',          icon: 'newspaper',       color: '#ef4444' },
  { id: 'productivity',  label: 'Productivity',  icon: 'checkmark-done',  color: '#f59e0b' },
  { id: 'other',         label: 'Other',         icon: 'apps',            color: '#6b7280' },
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

  // ── Content type + sources (all optional) ────────────────────────────────
  // contentType is one of: null | 'fact' | 'news' | 'opinion'. The picker
  // shows the relevant source block below it. Opinion is just a disclaimer.
  const [contentType,    setContentType]    = useState(null);
  const [sourceUrl,      setSourceUrl]      = useState('');
  const [sourceFiles,    setSourceFiles]    = useState([]);
  const [newsUrl,        setNewsUrl]        = useState('');
  const [newsPublisher,  setNewsPublisher]  = useState('');
  const [newsFiles,      setNewsFiles]      = useState([]);

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
      allowDownload,
      mimeType:     videoAsset.mimeType  || 'video/mp4',
      durationMs:   videoAsset.duration  || 0,   // used by VideoCompressor for progress estimation

      // Content type + sources — optional. The backend strips the slots
      // that don't apply to the chosen type, so it's safe to send all.
      contentType,
      sourceUrl:     contentType === 'fact' ? sourceUrl.trim()     : '',
      sourceFiles:   contentType === 'fact' ? sourceFiles          : [],
      newsUrl:       contentType === 'news' ? newsUrl.trim()       : '',
      newsPublisher: contentType === 'news' ? newsPublisher.trim() : '',
      newsFiles:     contentType === 'news' ? newsFiles            : [],
    };

    const res = await videoService.uploadVideo(
      videoAsset.uri,
      metadata,
      (pct) => setProgress(pct),
    );

    setUploading(false);
    setProgress(0);

    if (res.success) {
      const m = res.moderation;
      const modLine = m
        ? `\n\nModeration: ${m.status} (${Math.round((m.confidence || 0) * 100)}% confidence${m.fallback ? ', fallback' : ''})`
        : '';
      Alert.alert(
        'Uploaded!',
        `Your video has been uploaded and will appear in the feed shortly.${modLine}`,
        [{
          text: 'Great!',
          onPress: () => {
            setVideoAsset(null); setTitle(''); setDescription('');
            setTags(''); setSong(''); setCategory(''); setVisibility('public');
            setAllowDownload(true);
            setContentType(null);
            setSourceUrl(''); setSourceFiles([]);
            setNewsUrl(''); setNewsPublisher(''); setNewsFiles([]);
            navigation.navigate('Profile');
          },
        }],
      );
    } else {
      // Show the full message — it contains the step prefix so the user knows exactly what failed.
      // Moderation block (status/confidence) is already embedded in res.message by the backend.
      Alert.alert('Upload Failed', res.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <ScreenContainer backgroundColor="#f9fafb" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={S.header}>
          <Text style={S.title}>Upload</Text>
          <Text style={S.subtitle}>Share your knowledge with the world</Text>
        </View>

        {/* ── Empty state: info card + action cards + hint ──────────────── */}
        {!videoAsset ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 }}>

            {/* Premium priority note — replaces the old compression paragraph */}
            <LinearGradient
              colors={['#eff6ff', '#f5f3ff']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={S.infoCard}
            >
              <View style={S.infoIconWrap}>
                <Ionicons name="trending-up" size={18} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.infoTitle}>Informative content gets boosted</Text>
                <Text style={S.infoBody}>
                  Educational, technical and professional videos reach more viewers on TrueVision.
                </Text>
              </View>
            </LinearGradient>

            {/* Action cards */}
            <PressableCard onPress={pickVideo} style={S.actionCard}>
              <LinearGradient
                colors={['#3b82f6', '#8b5cf6']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={S.actionIcon}
              >
                <Ionicons name="folder-open" size={30} color="#fff" />
              </LinearGradient>
              <Text style={S.actionTitle}>Choose from Gallery</Text>
              <Text style={S.actionSubtitle}>Pick a video from your device</Text>
            </PressableCard>

            <PressableCard onPress={recordVideo} style={S.actionCard}>
              <LinearGradient
                colors={['#ef4444', '#ec4899']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={S.actionIcon}
              >
                <Ionicons name="videocam" size={30} color="#fff" />
              </LinearGradient>
              <Text style={S.actionTitle}>Record Video</Text>
              <Text style={S.actionSubtitle}>Capture a new clip (up to 5 min)</Text>
            </PressableCard>
          </View>
        ) : (
            <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }}>
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

              {/* Content type — Fact / News / Opinion (optional) */}
              <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 }}>Content Type</Text>
                <Text style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14 }}>
                  Optional — choose how viewers should read this video.
                </Text>
                <ContentTypePicker value={contentType} onChange={setContentType} />

                {/* Fact → Supporting Evidence */}
                {contentType === 'fact' ? (
                  <View style={{ marginTop: 16 }}>
                    <SourceUploader
                      title="Supporting Evidence (Optional)"
                      files={sourceFiles}
                      onChangeFiles={setSourceFiles}
                      url={sourceUrl}
                      onChangeUrl={setSourceUrl}
                      urlLabel="Paste source URL (e.g. research paper, article)"
                    />
                  </View>
                ) : null}

                {/* News → News Source */}
                {contentType === 'news' ? (
                  <View style={{ marginTop: 16 }}>
                    <SourceUploader
                      title="News Source (Optional)"
                      files={newsFiles}
                      onChangeFiles={setNewsFiles}
                      url={newsUrl}
                      onChangeUrl={setNewsUrl}
                      urlLabel="Paste news URL"
                      extraField={
                        <View style={{
                          flexDirection: 'row', alignItems: 'center',
                          backgroundColor: '#f8fafc',
                          borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
                          paddingHorizontal: 12, paddingVertical: 10,
                        }}>
                          <Ionicons name="business-outline" size={16} color="#64748b" style={{ marginRight: 8 }} />
                          <TextInput
                            value={newsPublisher}
                            onChangeText={setNewsPublisher}
                            placeholder="Publisher name (e.g. Reuters)"
                            placeholderTextColor="#94a3b8"
                            maxLength={120}
                            style={{ flex: 1, fontSize: 13.5, color: '#0f172a', padding: 0 }}
                          />
                        </View>
                      }
                    />
                  </View>
                ) : null}

                {/* Opinion → disclaimer only */}
                {contentType === 'opinion' ? (
                  <View style={{
                    marginTop: 16,
                    flexDirection: 'row', alignItems: 'flex-start',
                    backgroundColor: '#fffbeb',
                    borderRadius: 12, borderWidth: 1, borderColor: '#fde68a',
                    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
                  }}>
                    <Ionicons name="information-circle" size={18} color="#b45309" />
                    <Text style={{ flex: 1, fontSize: 12.5, color: '#92400e', lineHeight: 18 }}>
                      This content represents the creator&apos;s opinion. Viewers will see an &quot;Opinion&quot; chip on the video info panel.
                    </Text>
                  </View>
                ) : null}
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
                  <ActivityIndicator
                    size="large"
                    color={progress < 30 ? '#f59e0b' : progress < 95 ? '#3b82f6' : '#22c55e'}
                  />

                  {/* Stage label */}
                  <Text style={{ fontWeight: '700', fontSize: 18, color: '#0f172a', marginTop: 14 }}>
                    {progress === 0
                      ? 'Preparing…'
                      : progress < 30
                      ? `Compressing… ${Math.round((progress / 30) * 100)}%`
                      : progress < 95
                      ? `Uploading… ${Math.round(((progress - 30) / 64) * 100)}%`
                      : 'Saving…'}
                  </Text>

                  {/* Progress bar — colour shifts by stage */}
                  <View style={{ width: '100%', height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, marginTop: 16, overflow: 'hidden' }}>
                    <View style={{
                      width: `${Math.min(progress, 100)}%`,
                      height: '100%',
                      borderRadius: 4,
                      backgroundColor: progress < 30 ? '#f59e0b' : progress < 95 ? '#3b82f6' : '#22c55e',
                    }} />
                  </View>

                  {/* Sub-label */}
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                    {progress < 30
                      ? 'Reducing file size for faster upload — keep app open'
                      : progress < 95
                      ? 'Uploading directly to cloud — keep app open'
                      : 'Finalizing your video record…'}
                  </Text>

                  {/* File size hint */}
                  {videoAsset?.fileSize ? (
                    <Text style={{ color: '#cbd5e1', fontSize: 11, marginTop: 4 }}>
                      Original: {(videoAsset.fileSize / (1024 * 1024)).toFixed(1)} MB
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
            </View>
          )}
      </ScrollView>

      {/* Stylesheet for the redesigned empty state */}
    </ScreenContainer>
  );
}

const S = StyleSheet.create({
  // Header
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eef2f7',
  },
  title:    { fontSize: 28, fontWeight: '900', color: '#0f172a', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },

  // Premium info card
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 16, marginTop: 16, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)',
  },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  infoTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  infoBody:  { fontSize: 12.5, color: '#475569', lineHeight: 18 },

  // Action cards
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 24, paddingHorizontal: 20,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#eef2f7',
  },
  actionIcon: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#3b82f6',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  actionTitle:    { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 4, letterSpacing: -0.2 },
  actionSubtitle: { fontSize: 13, color: '#64748b' },
});
