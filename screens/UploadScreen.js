// truevision/screens/UploadScreen.js
//
// Premium redesign of the Upload screen (landing + details form). Theme-aware
// via useTheme(): a luxury dark palette in dark mode and a soft light variant
// in light mode — matching the two reference mockups. Only the VISUALS change;
// every piece of functionality (pick / record / metadata / upload flow) and
// the safe-area + navigation behaviour are preserved exactly.
//
// Icons: Ionicons outline variants (the app's icon system) standing in for the
// requested Lucide set — same minimal outline language, no new dependency.

import { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StatusBar, ScrollView,
  TextInput, Alert, Animated, Easing, StyleSheet, Pressable,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { Ionicons }        from '@expo/vector-icons';
import * as ImagePicker    from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer     from '../components/ScreenContainer';
import videoService        from '../services/VideoService';
import ContentTypePicker   from '../components/upload/ContentTypePicker';
import SourceUploader      from '../components/upload/SourceUploader';
import CircularProgress    from '../components/upload/CircularProgress';
import UploadResultModal   from '../components/upload/UploadResultModal';
import { useTheme }        from '../context/ThemeContext';

// Upload stages derived from the real 0–100 progress. Backend does the
// synchronous AI moderation during the "save" phase (95–99), hence that label.
const uploadStage = (p) => {
  if (p <= 0)  return 'Preparing video…';
  if (p < 30)  return 'Compressing video…';
  if (p < 95)  return 'Uploading…';
  if (p < 100) return 'Running AI moderation…';
  return 'Completed';
};
const fmtETA = (secs) => {
  if (!secs || !isFinite(secs) || secs <= 0) return '';
  if (secs < 60) return `${Math.ceil(secs)}s left`;
  return `${Math.floor(secs / 60)}m ${Math.ceil(secs % 60)}s left`;
};

// ─── Premium palette (theme-aware) ──────────────────────────────────────────
// Dark values come straight from the design brief; light values are the
// calibrated equivalents from the light mockup.
const getPalette = (isDark) => (isDark ? {
  bg:          '#09090B',
  bg2:         '#111217',
  card:        '#171923',
  cardAlt:     '#1C1F2B',
  border:      'rgba(255,255,255,0.06)',
  borderStrong:'rgba(255,255,255,0.10)',
  text:        '#FFFFFF',
  textSec:     '#A5A8B8',
  textMuted:   '#72778C',
  purple:      '#6C5CFF',
  purple2:     '#8B7DFF',
  pink:        '#FF4FA3',
  infoGlass:   'rgba(108,92,255,0.10)',
  infoBorder:  'rgba(108,92,255,0.22)',
  glassChip:   'rgba(255,255,255,0.05)',
  inputBg:     '#111217',
  inputBorder: 'rgba(255,255,255,0.08)',
  cloudIcon:   '#B9AEFF',
  cloudGlow:   'rgba(108,92,255,0.35)',
} : {
  bg:          '#F5F6FB',
  bg2:         '#FFFFFF',
  card:        '#FFFFFF',
  cardAlt:     '#F8F9FD',
  border:      'rgba(15,23,42,0.06)',
  borderStrong:'rgba(15,23,42,0.10)',
  text:        '#0E1122',
  textSec:     '#5B6070',
  textMuted:   '#9498A8',
  purple:      '#6C5CFF',
  purple2:     '#8B7DFF',
  pink:        '#FF4FA3',
  infoGlass:   '#F0EFFE',
  infoBorder:  'rgba(108,92,255,0.16)',
  glassChip:   'rgba(15,23,42,0.04)',
  inputBg:     '#F4F5F9',
  inputBorder: 'rgba(15,23,42,0.08)',
  cloudIcon:   '#6C5CFF',
  cloudGlow:   'rgba(108,92,255,0.22)',
});

// ─── Mount entrance: fade + slide-up, optionally staggered ──────────────────
const EntranceView = ({ delay = 0, children, style }) => {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1, duration: 380, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [t, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

// ─── Premium pressable card: scale + glow lift on press ─────────────────────
const PressableCard = ({ onPress, disabled, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handleIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8, tension: 220 }).start();
  const handleOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 200 }).start();
  return (
    <TouchableOpacity
      activeOpacity={0.9}
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

// ─── Visibility pill: animated selected state + press scale + ripple ────────
const VisibilityPill = ({ item, active, P, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Animated.View style={{ flex: 1, marginRight: item.id !== 'private' ? 8 : 0, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.95)}
        onPressOut={() => to(1)}
        android_ripple={{ color: P.glassChip, borderless: false }}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.label}
        style={{
          alignItems: 'center', paddingVertical: 13, borderRadius: 14, overflow: 'hidden',
          backgroundColor: active ? P.purple : P.glassChip,
          borderWidth: 1.5, borderColor: active ? P.purple : P.border,
          ...(active ? { shadowColor: '#6C5CFF', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 } : {}),
        }}
      >
        <Ionicons name={item.icon} size={18} color={active ? '#fff' : P.textMuted} />
        <Text style={{ marginTop: 4, fontSize: 11, fontWeight: '700', color: active ? '#fff' : P.textSec }}>{item.label}</Text>
      </Pressable>
    </Animated.View>
  );
};

// ─── Cloud + upload illustration (composed from primitives + Ionicons) ──────
const CloudIllustration = ({ P }) => (
  <View style={ill.wrap} pointerEvents="none">
    {/* soft radial glow */}
    <View style={[ill.glow, { backgroundColor: P.cloudGlow }]} />
    {/* faint back cloud for depth */}
    <Ionicons name="cloud" size={72} color={P.purple} style={ill.backCloud} />
    {/* main upload cloud */}
    <Ionicons name="cloud-upload" size={62} color={P.cloudIcon} style={ill.mainCloud} />
    {/* sparkles */}
    <View style={[ill.dot, { top: 6,  right: 4,  backgroundColor: P.purple2 }]} />
    <View style={[ill.dot, { top: 30, right: 82, backgroundColor: P.pink, opacity: 0.9 }]} />
    <View style={[ill.dotSm, { top: 2, right: 54, backgroundColor: P.purple2, opacity: 0.8 }]} />
  </View>
);

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
  const { isDark } = useTheme();
  const P = getPalette(isDark);

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
  const [eta,          setEta]          = useState('');   // "12s left"
  const [uploadResult, setUploadResult] = useState(null); // { kind, moderation, videoId, message }
  const [reviewBusy,   setReviewBusy]   = useState(false);
  const insets = useSafeAreaInsets();

  // Speed/ETA estimation from the real progress stream (no faked values).
  const rateRef = useRef({ t: 0, p: 0 });

  // ── Content type + sources (all optional) ────────────────────────────────
  // contentType is one of: null | 'fact' | 'news' | 'opinion'. The picker
  // shows the relevant source block below it. Opinion is just a disclaimer.
  const [contentType,    setContentType]    = useState(null);
  const [sourceUrl,      setSourceUrl]      = useState('');
  const [sourceFiles,    setSourceFiles]    = useState([]);
  const [newsUrl,        setNewsUrl]        = useState('');
  const [newsPublisher,  setNewsPublisher]  = useState('');
  const [newsFiles,      setNewsFiles]      = useState([]);

  // Page fade-in
  const pageFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(pageFade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [pageFade]);

  // Animated download switch (thumb slide + track colour).
  const dlAnim = useRef(new Animated.Value(allowDownload ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(dlAnim, { toValue: allowDownload ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [allowDownload, dlAnim]);

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

  // Back chip: if a video is chosen, clearing it returns to the landing;
  // otherwise fall back to Home (Upload is a root tab with no push history).
  const handleBack = () => {
    if (videoAsset) { setVideoAsset(null); return; }
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('Home');
  };

  // Reset the just-filled form after a successful/blocked upload.
  const resetForm = () => {
    setVideoAsset(null); setTitle(''); setDescription('');
    setTags(''); setSong(''); setCategory(''); setVisibility('public');
    setAllowDownload(true); setContentType(null);
    setSourceUrl(''); setSourceFiles([]);
    setNewsUrl(''); setNewsPublisher(''); setNewsFiles([]);
  };

  // Real progress → smooth % + a live ETA estimate from the actual rate.
  const onUploadProgress = (pct) => {
    setProgress(pct);
    const now = Date.now();
    const { t, p } = rateRef.current;
    if (t && pct > p) {
      const rate = (pct - p) / ((now - t) / 1000); // %/sec
      if (rate > 0) setEta(fmtETA((100 - pct) / rate));
    }
    rateRef.current = { t: now, p: pct };
  };

  const handleUpload = async () => {
    if (!videoAsset) { setUploadResult({ kind: 'failed', message: 'Please select or record a video first.' }); return; }
    if (!title.trim()) { setUploadResult({ kind: 'failed', message: 'Please enter a title for your video.' }); return; }
    if (!category)     { setUploadResult({ kind: 'failed', message: 'Please choose a category first.' }); return; }

    setUploading(true);
    setProgress(0);
    setEta('');
    rateRef.current = { t: Date.now(), p: 0 };

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

    let res;
    try {
      res = await videoService.uploadVideo(videoAsset.uri, metadata, onUploadProgress);
    } catch (err) {
      res = { success: false, message: err?.message || 'Upload failed unexpectedly.' };
    }

    if (res.success) {
      setProgress(100); setEta('');          // snap the bar fully home before the modal
      await new Promise((r) => setTimeout(r, 220));
      setUploading(false);

      // Map the backend moderation decision → the result modal.
      const status = res.reviewStatus;
      const kind = res.blocked || status === 'blocked' ? 'blocked'
                 : status === 'approved' ? 'approved'
                 : 'pending';   // processing / pending_review
      const videoId = res.video?._id || res.video?.id || null;
      resetForm();
      setUploadResult({ kind, moderation: res.moderation || {}, videoId });
    } else {
      setUploading(false); setProgress(0); setEta('');
      setUploadResult({ kind: 'failed', message: res.message || 'Something went wrong. Please try again.' });
    }
  };

  // ── Result modal actions ──────────────────────────────────────────────────
  const closeResult   = () => setUploadResult(null);
  const viewUploaded  = () => { const id = uploadResult?.videoId; setUploadResult(null); navigation.navigate(id ? 'Profile' : 'Profile'); };
  const retryUpload   = () => { setUploadResult(null); handleUpload(); };
  const requestReview = async () => {
    const id = uploadResult?.videoId;
    if (!id) { setUploadResult(null); return; }
    setReviewBusy(true);
    const r = await videoService.submitReviewRequest(id, {
      reason: 'Creator believes this is informative content',
      description: '',
    });
    setReviewBusy(false);
    setUploadResult(null);
    // Confirm via a short pending state so the creator gets feedback.
    setTimeout(() => setUploadResult({
      kind: 'pending',
      moderation: uploadResult?.moderation || {},
      message: r?.success
        ? 'Your review request was submitted. We’ll notify you with the decision.'
        : (r?.message || 'Could not submit the review request.'),
    }), 60);
  };

  // Shared input style for the details form.
  const inputStyle = (focused) => ({
    backgroundColor: P.inputBg,
    borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
    color: P.text, fontSize: 14, marginBottom: 14,
    borderWidth: 1.5, borderColor: focused ? P.purple : P.inputBorder,
  });
  const labelStyle = { fontWeight: '600', color: P.textSec, marginBottom: 6, fontSize: 13 };
  const cardStyle = {
    backgroundColor: P.card, borderRadius: 24, padding: 20, marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: P.border,
    shadowColor: '#000', shadowOpacity: isDark ? 0.3 : 0.05, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 3,
  };

  return (
    <ScreenContainer backgroundColor={P.bg} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={P.bg} />

      <Animated.View style={{ flex: 1, opacity: pageFade }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: (insets.bottom || 0) + 140 }}
        >
          {/* ── Header ───────────────────────────────────────────────────── */}
          <View style={S.header}>
            <TouchableOpacity
              onPress={handleBack}
              activeOpacity={0.8}
              style={[S.backChip, { backgroundColor: P.glassChip, borderColor: P.border }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={22} color={P.text} />
            </TouchableOpacity>

            <View style={S.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[S.title, { color: P.text }]}>Upload</Text>
                <Text style={[S.subtitle, { color: P.textSec }]}>Share your knowledge with the world</Text>
              </View>
              <CloudIllustration P={P} />
            </View>
          </View>

          {/* ── Empty state: info card + action cards ─────────────────────── */}
          {!videoAsset ? (
            <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>

              {/* Premium priority note */}
              <EntranceView delay={40}>
                <View style={[S.infoCard, { backgroundColor: P.infoGlass, borderColor: P.infoBorder }]}>
                  <View style={[S.infoIconWrap, { backgroundColor: 'rgba(108,92,255,0.16)' }]}>
                    <Ionicons name="trending-up" size={19} color={P.purple} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.infoTitle, { color: P.purple }]}>Informative content gets boosted</Text>
                    <Text style={[S.infoBody, { color: P.textSec }]}>
                      Educational, technical and professional videos reach more viewers on TrueVision.
                    </Text>
                  </View>
                </View>
              </EntranceView>

              {/* Choose from Gallery */}
              <EntranceView delay={120}>
                <PressableCard onPress={pickVideo} style={[S.actionCard, { backgroundColor: P.card, borderColor: P.border }]}>
                  {/* bottom edge glow */}
                  <LinearGradient
                    colors={['rgba(108,92,255,0)', 'rgba(108,92,255,0.55)', 'rgba(108,92,255,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={S.cardGlow}
                    pointerEvents="none"
                  />
                  <LinearGradient
                    colors={['#6C5CFF', '#8B7DFF']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[S.actionIcon, { shadowColor: '#6C5CFF' }]}
                  >
                    <Ionicons name="folder-outline" size={28} color="#fff" />
                  </LinearGradient>
                  <View style={S.actionText}>
                    <Text style={[S.actionTitle, { color: P.text }]}>Choose from Gallery</Text>
                    <Text style={[S.actionSubtitle, { color: P.textSec }]}>Pick a video from your device</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={P.textMuted} />
                </PressableCard>
              </EntranceView>

              {/* Record Video */}
              <EntranceView delay={200}>
                <PressableCard onPress={recordVideo} style={[S.actionCard, { backgroundColor: P.card, borderColor: P.border }]}>
                  <LinearGradient
                    colors={['rgba(255,79,163,0)', 'rgba(255,79,163,0.5)', 'rgba(255,79,163,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={S.cardGlow}
                    pointerEvents="none"
                  />
                  <LinearGradient
                    colors={['#FF4FA3', '#B24BFF']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[S.actionIcon, { shadowColor: '#FF4FA3' }]}
                  >
                    <Ionicons name="videocam-outline" size={28} color="#fff" />
                  </LinearGradient>
                  <View style={S.actionText}>
                    <Text style={[S.actionTitle, { color: P.text }]}>Record Video</Text>
                    <Text style={[S.actionSubtitle, { color: P.textSec }]}>Capture a new clip (up to 5 min)</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={P.textMuted} />
                </PressableCard>
              </EntranceView>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
              {/* Preview */}
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: P.text }}>Video Selected</Text>
                  <TouchableOpacity onPress={() => setVideoAsset(null)} style={{ backgroundColor: 'rgba(255,79,163,0.14)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
                    <Text style={{ color: P.pink, fontWeight: '700', fontSize: 13 }}>Remove</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ backgroundColor: P.bg2, borderRadius: 24, height: 180, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: P.border }}>
                  {videoAsset.uri ? (
                    <View style={{ alignItems: 'center' }}>
                      <Ionicons name="checkmark-circle" size={52} color="#22c55e" />
                      <Text style={{ color: P.text, marginTop: 10, fontWeight: '700', fontSize: 15 }}>Video ready to upload</Text>
                      {videoAsset.duration && (
                        <Text style={{ color: P.textMuted, marginTop: 4, fontSize: 12 }}>
                          Duration: {Math.floor(videoAsset.duration / 1000)}s
                        </Text>
                      )}
                      {videoAsset.fileSize && (
                        <Text style={{ color: P.textMuted, marginTop: 2, fontSize: 12 }}>
                          Size: {(videoAsset.fileSize / (1024 * 1024)).toFixed(1)} MB
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Ionicons name="play-circle" size={52} color={P.text} />
                  )}
                </View>
              </View>

              {/* Details */}
              <View style={cardStyle}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: P.text, marginBottom: 16 }}>Video Details</Text>

                <Text style={labelStyle}>Title *</Text>
                <TextInput
                  placeholder="Give your video a catchy title"
                  placeholderTextColor={P.textMuted}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={150}
                  style={inputStyle(!!title)}
                />

                <Text style={labelStyle}>Description</Text>
                <TextInput
                  placeholder="Tell viewers about your video..."
                  placeholderTextColor={P.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  maxLength={2200}
                  textAlignVertical="top"
                  style={[inputStyle(false), { minHeight: 90 }]}
                />

                <Text style={labelStyle}>Tags</Text>
                <TextInput
                  placeholder="#travel, #food, #vlog"
                  placeholderTextColor={P.textMuted}
                  value={tags}
                  onChangeText={setTags}
                  style={inputStyle(false)}
                />

                <Text style={labelStyle}>Song / Audio</Text>
                <TextInput
                  placeholder="Original Sound – yourname"
                  placeholderTextColor={P.textMuted}
                  value={song}
                  onChangeText={setSong}
                  style={[inputStyle(false), { marginBottom: 0 }]}
                />
              </View>

              {/* Category */}
              <View style={cardStyle}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: P.text, marginBottom: 14 }}>Category *</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {CATEGORIES.map((cat) => {
                    const active = category === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setCategory(cat.id)}
                        activeOpacity={0.75}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          marginRight: 10, marginBottom: 10,
                          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
                          backgroundColor: active ? cat.color : P.glassChip,
                          borderWidth: 1.5,
                          borderColor: active ? cat.color : P.border,
                        }}
                      >
                        <Ionicons name={cat.icon} size={15} color={active ? '#fff' : cat.color} />
                        <Text style={{ marginLeft: 6, fontWeight: '600', fontSize: 13, color: active ? '#fff' : P.textSec }}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Content type — Fact / News / Opinion (optional) */}
              <View style={cardStyle}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: P.text, marginBottom: 4 }}>Content Type</Text>
                <Text style={{ fontSize: 12.5, color: P.textMuted, marginBottom: 14 }}>
                  Optional — choose how viewers should read this video.
                </Text>
                <ContentTypePicker value={contentType} onChange={setContentType} />

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
                          backgroundColor: P.inputBg,
                          borderRadius: 10, borderWidth: 1, borderColor: P.inputBorder,
                          paddingHorizontal: 12, paddingVertical: 10,
                        }}>
                          <Ionicons name="business-outline" size={16} color={P.textMuted} style={{ marginRight: 8 }} />
                          <TextInput
                            value={newsPublisher}
                            onChangeText={setNewsPublisher}
                            placeholder="Publisher name (e.g. Reuters)"
                            placeholderTextColor={P.textMuted}
                            maxLength={120}
                            style={{ flex: 1, fontSize: 13.5, color: P.text, padding: 0 }}
                          />
                        </View>
                      }
                    />
                  </View>
                ) : null}

                {contentType === 'opinion' ? (
                  <View style={{
                    marginTop: 16,
                    flexDirection: 'row', alignItems: 'flex-start',
                    backgroundColor: 'rgba(245,158,11,0.10)',
                    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.30)',
                    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
                  }}>
                    <Ionicons name="information-circle" size={18} color="#f59e0b" />
                    <Text style={{ flex: 1, fontSize: 12.5, color: isDark ? '#fbbf77' : '#92400e', lineHeight: 18 }}>
                      This content represents the creator&apos;s opinion. Viewers will see an &quot;Opinion&quot; chip on the video info panel.
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Visibility */}
              <View style={cardStyle}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: P.text, marginBottom: 14 }}>Visibility</Text>
                <View style={{ flexDirection: 'row' }}>
                  {VISIBILITY.map((v) => (
                    <VisibilityPill
                      key={v.id}
                      item={v}
                      active={visibility === v.id}
                      P={P}
                      onPress={() => setVisibility(v.id)}
                    />
                  ))}
                </View>
              </View>

              {/* Allow Download toggle — animated switch + ripple */}
              <View style={[cardStyle, { overflow: 'hidden' }]}>
                <Pressable
                  onPress={() => setAllowDownload(d => !d)}
                  android_ripple={{ color: P.glassChip }}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: allowDownload }}
                  accessibilityLabel="Allow downloads"
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Ionicons name="download-outline" size={22} color={P.purple} style={{ marginRight: 12 }} />
                    <View>
                      <Text style={{ fontWeight: '700', fontSize: 15, color: P.text }}>Allow Downloads</Text>
                      <Text style={{ fontSize: 12, color: P.textMuted, marginTop: 2 }}>Let viewers download your video</Text>
                    </View>
                  </View>
                  <Animated.View style={{
                    width: 50, height: 30, borderRadius: 15, justifyContent: 'center', paddingHorizontal: 3,
                    backgroundColor: dlAnim.interpolate({ inputRange: [0, 1], outputRange: [P.inputBorder, P.purple] }),
                  }}>
                    <Animated.View style={{
                      width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff',
                      transform: [{ translateX: dlAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }],
                      shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
                    }} />
                  </Animated.View>
                </Pressable>
              </View>

              {/* Upload button */}
              {/* Disclaimer — always visible, never hidden behind the nav bar */}
              <View style={[S.disclaimer, { backgroundColor: P.infoGlass, borderColor: P.infoBorder }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={P.purple} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, marginLeft: 12, color: P.textSec, fontSize: 12.5, lineHeight: 18 }}>
                  By uploading, you confirm this is your own content and follows TrueVision’s community
                  guidelines. Videos are checked by AI — entertainment-only content isn’t allowed.
                </Text>
              </View>

              {uploading ? (
                <View style={[cardStyle, { padding: 26, alignItems: 'center', marginBottom: 8 }]}>
                  <CircularProgress
                    size={152}
                    thickness={12}
                    progress={progress}
                    color={progress < 30 ? '#F59E0B' : progress < 100 ? P.purple : '#22C55E'}
                    track={P.inputBorder}
                  >
                    <Text style={{ fontSize: 34, fontWeight: '800', color: P.text }}>{Math.round(progress)}%</Text>
                    <Text style={{ fontSize: 12, color: P.textMuted, marginTop: 2, minHeight: 15 }}>{eta}</Text>
                  </CircularProgress>

                  <Text style={{ fontWeight: '700', fontSize: 17, color: P.text, marginTop: 18 }}>
                    {uploadStage(progress)}
                  </Text>
                  <Text style={{ color: P.textMuted, fontSize: 12.5, marginTop: 6, textAlign: 'center' }}>
                    Keep the app open while your video uploads.
                  </Text>
                  {videoAsset?.fileSize ? (
                    <Text style={{ color: P.textMuted, fontSize: 11, marginTop: 4 }}>
                      {(videoAsset.fileSize / (1024 * 1024)).toFixed(1)} MB
                    </Text>
                  ) : null}
                </View>
              ) : (
                <TouchableOpacity onPress={handleUpload} activeOpacity={0.9} style={{ marginBottom: 8 }}>
                  <LinearGradient
                    colors={['#6C5CFF', '#4D63FF']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ borderRadius: 22, padding: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', shadowColor: '#6C5CFF', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}
                  >
                    <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 10 }}>Upload Video</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Premium result modal — replaces the stock Alert for every outcome */}
      <UploadResultModal
        visible={!!uploadResult}
        result={uploadResult}
        busy={reviewBusy}
        onClose={closeResult}
        onViewVideo={viewUploaded}
        onRequestReview={requestReview}
        onRetry={retryUpload}
      />
    </ScreenContainer>
  );
}

// ─── Illustration styles ─────────────────────────────────────────────────────
const ill = StyleSheet.create({
  wrap: { width: 120, height: 96, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute', width: 108, height: 108, borderRadius: 54,
    opacity: 0.9, top: -4, right: 4,
  },
  backCloud: { position: 'absolute', top: 30, right: 34, opacity: 0.35 },
  mainCloud: { position: 'absolute', top: 22, right: 26 },
  dot:   { position: 'absolute', width: 7, height: 7, borderRadius: 4 },
  dotSm: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
});

const S = StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8,
  },
  backChip: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    minHeight: 96,
  },
  title:    { fontSize: 36, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: 15, marginTop: 6, fontWeight: '500' },

  // Premium info card
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 22, marginTop: 8, marginBottom: 22,
    borderWidth: 1,
  },
  infoIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  infoTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4, letterSpacing: -0.2 },
  infoBody:  { fontSize: 13, lineHeight: 19 },

  // Disclaimer card (details view) — premium, always visible above the nav bar.
  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 16,
  },

  // Action cards — premium horizontal
  actionCard: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: 100,
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardGlow: {
    position: 'absolute',
    left: 24, right: 24, bottom: 0, height: 3,
    borderRadius: 3,
  },
  actionIcon: {
    width: 60, height: 60, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 18,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  actionText: { flex: 1 },
  actionTitle:    { fontSize: 20, fontWeight: '700', marginBottom: 4, letterSpacing: -0.3 },
  actionSubtitle: { fontSize: 14, fontWeight: '500' },
});
