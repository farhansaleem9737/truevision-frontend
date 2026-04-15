// truevision/screens/EditProfileScreen.js
import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StatusBar,
  ScrollView, Image, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import * as ImagePicker   from 'expo-image-picker';
import ScreenContainer    from '../components/ScreenContainer';
import userService        from '../services/UserService';
import { useAuth }        from '../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// INPUT ROW component
// ─────────────────────────────────────────────────────────────────────────────
const Field = ({ label, icon, children, hint, error }) => (
  <View style={[S.card, error && { borderWidth: 1.5, borderColor: '#ef4444' }]}>
    <Text style={S.fieldLabel}>{label}</Text>
    <View style={S.fieldRow}>
      <Ionicons name={icon} size={18} color={error ? '#ef4444' : '#3b82f6'} style={{ marginRight: 10 }} />
      {children}
    </View>
    {(hint || error) && (
      <Text style={[S.fieldHint, error && { color: '#ef4444' }]}>{error || hint}</Text>
    )}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function EditProfileScreen({ navigation }) {
  const { user, updateUser } = useAuth();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio,      setBio]      = useState(user?.bio      || '');
  const [country,  setCountry]  = useState(user?.country  || '');

  // ── Image state ─────────────────────────────────────────────────────────────
  const [previewUri,   setPreviewUri]   = useState(user?.profileImage || null);
  const [pickedAsset,  setPickedAsset]  = useState(null);   // { uri, mimeType }

  // ── Loading states ──────────────────────────────────────────────────────────
  const [imgProgress, setImgProgress] = useState(0);
  const [imgStage,    setImgStage]    = useState('');   // 'uploading' | 'saving' | ''
  const [saving,      setSaving]      = useState(false);

  // ── Validation errors ───────────────────────────────────────────────────────
  const [errors, setErrors] = useState({});

  const isBusy = saving || imgStage !== '';

  // ── Pick from gallery or camera ─────────────────────────────────────────────
  const pickImage = useCallback(() => {
    Alert.alert('Change Profile Photo', 'Choose an option', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            return Alert.alert('Permission Required', 'Camera access is needed to take a photo.');
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!result.canceled) {
            const asset = result.assets[0];
            setPickedAsset(asset);
            setPreviewUri(asset.uri);
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            return Alert.alert('Permission Required', 'Photo library access is needed.');
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!result.canceled) {
            const asset = result.assets[0];
            setPickedAsset(asset);
            setPreviewUri(asset.uri);
          }
        },
      },
      { text: 'Remove Photo', style: 'destructive', onPress: confirmRemovePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  // ── Remove profile photo ────────────────────────────────────────────────────
  const confirmRemovePhoto = useCallback(() => {
    if (!user?.profileImage && !pickedAsset) return;
    Alert.alert('Remove Photo', 'Are you sure you want to remove your profile picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          setSaving(true);
          const res = await userService.removeProfileImage();
          setSaving(false);
          if (res.success) {
            setPreviewUri(null);
            setPickedAsset(null);
            await updateUser(res.user);
          } else {
            Alert.alert('Error', res.message || 'Could not remove photo');
          }
        },
      },
    ]);
  }, [user, pickedAsset, updateUser]);

  // ── Validate form ────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!fullName.trim())                    e.fullName = 'Full name is required';
    else if (fullName.trim().length < 2)     e.fullName = 'At least 2 characters';
    if (!username.trim())                    e.username = 'Username is required';
    else if (username.trim().length < 3)     e.username = 'At least 3 characters';
    else if (!/^[a-z0-9_]+$/.test(username)) e.username = 'Only a–z, 0–9, and _';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      let updatedUser = null;

      // ── 1. Upload new profile image (if picked) ─────────────────────────────
      if (pickedAsset) {
        setImgStage('uploading');
        setImgProgress(0);

        const mimeType = pickedAsset.mimeType || 'image/jpeg';
        const imgRes   = await userService.uploadProfileImage(
          pickedAsset.uri,
          mimeType,
          (pct) => setImgProgress(pct),
        );

        setImgStage('');
        if (!imgRes.success) {
          Alert.alert('Photo Upload Failed', imgRes.message || 'Could not upload profile photo. Try again.');
          setSaving(false);
          return;
        }
        updatedUser = imgRes.user;
      }

      // ── 2. Save profile text fields ─────────────────────────────────────────
      const profileRes = await userService.updateProfile({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        bio:      bio.trim(),
        country:  country.trim(),
      });

      if (!profileRes.success) {
        Alert.alert('Save Failed', profileRes.message || 'Could not update profile. Please try again.');
        setSaving(false);
        return;
      }

      // ── 3. Sync latest data to AuthContext ──────────────────────────────────
      const finalUser = { ...(updatedUser || {}), ...profileRes.user };
      await updateUser(finalUser);

      Alert.alert('Profile Updated', 'Your profile has been saved successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
      setImgStage('');
    }
  }, [fullName, username, bio, country, pickedAsset, updateUser, navigation]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const initials = (user?.fullName || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const uploadLabel = () => {
    if (imgStage === 'uploading') return `Uploading photo… ${imgProgress}%`;
    if (saving)                   return 'Saving profile…';
    return 'Save Changes';
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <ScreenContainer backgroundColor="#f1f5f9" edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#3b82f6" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── GRADIENT HEADER ──────────────────────────────────────────────── */}
          <LinearGradient
            colors={['#3b82f6', '#8b5cf6']}
            style={S.header}
          >
            {/* Top row */}
            <View style={S.headerRow}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn} disabled={isBusy}>
                <Ionicons name="arrow-back" size={22} color="white" />
              </TouchableOpacity>

              <Text style={S.headerTitle}>Edit Profile</Text>

              <TouchableOpacity
                onPress={handleSave}
                disabled={isBusy}
                style={[S.saveHeaderBtn, isBusy && { opacity: 0.6 }]}
              >
                {isBusy
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={S.saveHeaderText}>Save</Text>
                }
              </TouchableOpacity>
            </View>

            {/* ── Avatar ───────────────────────────────────────────────────── */}
            <View style={{ alignItems: 'center', paddingBottom: 28 }}>
              <TouchableOpacity
                onPress={pickImage}
                disabled={isBusy}
                activeOpacity={0.85}
                style={S.avatarWrap}
              >
                {/* Avatar image or initials */}
                {previewUri ? (
                  <Image source={{ uri: previewUri }} style={S.avatarImg} />
                ) : (
                  <View style={S.avatarPlaceholder}>
                    <Text style={S.avatarInitials}>{initials}</Text>
                  </View>
                )}

                {/* Camera badge */}
                <LinearGradient
                  colors={['#3b82f6', '#8b5cf6']}
                  style={S.cameraBadge}
                >
                  <Ionicons name="camera" size={14} color="white" />
                </LinearGradient>

                {/* Upload progress ring overlay */}
                {imgStage === 'uploading' && (
                  <View style={S.avatarOverlay}>
                    <ActivityIndicator color="white" size="large" />
                    <Text style={S.avatarOverlayText}>{imgProgress}%</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={pickImage} disabled={isBusy} style={{ marginTop: 10 }}>
                <Text style={S.changePhotoText}>
                  {pickedAsset ? 'Change again' : 'Change Photo'}
                </Text>
              </TouchableOpacity>
              {pickedAsset && (
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 }}>
                  New photo selected — will upload on Save
                </Text>
              )}
            </View>
          </LinearGradient>

          {/* ── FORM ─────────────────────────────────────────────────────────── */}
          <View style={S.form}>

            {/* Full Name */}
            <Field label="Full Name" icon="person-outline" error={errors.fullName}>
              <TextInput
                value={fullName}
                onChangeText={(t) => { setFullName(t); setErrors(e => ({ ...e, fullName: '' })); }}
                placeholder="Your full name"
                placeholderTextColor="#94a3b8"
                maxLength={50}
                editable={!isBusy}
                style={S.input}
              />
            </Field>

            {/* Username */}
            <Field
              label="Username"
              icon="at-outline"
              error={errors.username}
              hint="Only a–z, 0–9, and underscores"
            >
              <TextInput
                value={username}
                onChangeText={(t) => {
                  setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  setErrors(e => ({ ...e, username: '' }));
                }}
                placeholder="your_username"
                placeholderTextColor="#94a3b8"
                maxLength={30}
                autoCapitalize="none"
                editable={!isBusy}
                style={S.input}
              />
            </Field>

            {/* Bio */}
            <Field label="Bio" icon="document-text-outline">
              <View style={{ flex: 1 }}>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell people about yourself…"
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  maxLength={150}
                  textAlignVertical="top"
                  editable={!isBusy}
                  style={[S.input, { minHeight: 72, lineHeight: 22 }]}
                />
                <Text style={[S.charCount, bio.length > 130 && { color: '#ef4444' }]}>
                  {bio.length}/150
                </Text>
              </View>
            </Field>

            {/* Country */}
            <Field label="Country" icon="globe-outline">
              <TextInput
                value={country}
                onChangeText={setCountry}
                placeholder="Your country"
                placeholderTextColor="#94a3b8"
                maxLength={60}
                editable={!isBusy}
                style={S.input}
              />
            </Field>

            {/* Email — read only */}
            <View style={[S.card, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' }]}>
              <Text style={S.fieldLabel}>Email (cannot be changed)</Text>
              <View style={S.fieldRow}>
                <Ionicons name="mail-outline" size={18} color="#94a3b8" style={{ marginRight: 10 }} />
                <Text style={[S.input, { color: '#94a3b8', flex: 1 }]}>{user?.email}</Text>
                <Ionicons name="lock-closed-outline" size={14} color="#94a3b8" />
              </View>
            </View>

            {/* Save button */}
            <TouchableOpacity onPress={handleSave} disabled={isBusy} activeOpacity={0.85}>
              <LinearGradient
                colors={isBusy ? ['#94a3b8', '#94a3b8'] : ['#3b82f6', '#8b5cf6']}
                style={S.saveBtn}
              >
                {isBusy
                  ? <ActivityIndicator color="white" size="small" style={{ marginRight: 10 }} />
                  : <Ionicons name="checkmark-circle" size={22} color="white" style={{ marginRight: 10 }} />
                }
                <Text style={S.saveBtnText}>{uploadLabel()}</Text>
              </LinearGradient>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  header: {
    paddingTop:    20,
    paddingBottom: 0,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  24,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign:  'center',
    fontSize:   20,
    fontWeight: '900',
    color:      'white',
  },
  saveHeaderBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 18,
    paddingVertical:    8,
    borderRadius:      20,
    minWidth: 60,
    alignItems: 'center',
  },
  saveHeaderText: {
    color: 'white', fontWeight: '800', fontSize: 14,
  },

  // Avatar
  avatarWrap: {
    width: 108, height: 108, borderRadius: 54,
    borderWidth: 3, borderColor: 'white',
    overflow: 'visible',
  },
  avatarImg: {
    width: 102, height: 102, borderRadius: 51,
  },
  avatarPlaceholder: {
    width: 102, height: 102, borderRadius: 51,
    backgroundColor: '#1e40af',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: {
    color: 'white', fontSize: 36, fontWeight: '900',
  },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2.5, borderColor: 'white',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 51,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarOverlayText: {
    color: 'white', fontSize: 12, fontWeight: '700', marginTop: 4,
  },
  changePhotoText: {
    color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '700',
  },

  // Form
  form: {
    paddingHorizontal: 20,
    paddingTop:        24,
    paddingBottom:     48,
    gap:               14,
  },
  card: {
    backgroundColor: 'white',
    borderRadius:    18,
    padding:         18,
    shadowColor:     '#000',
    shadowOpacity:   0.04,
    shadowRadius:    8,
    elevation:       2,
  },
  fieldLabel: {
    fontSize:       12,
    fontWeight:     '700',
    color:          '#64748b',
    textTransform:  'uppercase',
    letterSpacing:  0.5,
    marginBottom:   10,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  input: {
    flex:       1,
    fontSize:   15,
    color:      '#0f172a',
    fontWeight: '500',
    padding:    0,
  },
  fieldHint: {
    fontSize:   11,
    color:      '#94a3b8',
    marginTop:  6,
  },
  charCount: {
    fontSize:  11,
    color:     '#94a3b8',
    textAlign: 'right',
    marginTop: 4,
  },

  // Save button
  saveBtn: {
    borderRadius:    18,
    padding:         18,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    elevation:       4,
    shadowColor:     '#3b82f6',
    shadowOpacity:   0.3,
    shadowRadius:    8,
  },
  saveBtnText: {
    color: 'white', fontWeight: '800', fontSize: 16,
  },
});
