// truevision/screens/support/ContactUsScreen.js
//
// Working Contact Us form → POST /api/support/contact. Fields: subject,
// category, message, optional attachment (uploaded to Cloudinary with a live
// progress bar), email (prefilled) and the auto-included diagnostics + user id.
// Loading, success/error snackbars, offline guard, dark mode.

import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/settings/ScreenHeader';
import { LabeledInput, CategoryChips, DiagnosticsCard, AttachmentTile } from '../../components/support/FormParts';
import { useSnackbar } from '../../components/Snackbar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import supportService from '../../services/SupportService';
import { collectDiagnostics } from '../../utils/diagnostics';
import { CONTACT_CATEGORIES } from '../../constants/supportCategories';

export default function ContactUsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const net = useNetworkStatus();
  const { showSuccess, showError, node: snackbar } = useSnackbar();

  const [subject, setSubject]   = useState('');
  const [category, setCategory] = useState('account');
  const [message, setMessage]   = useState('');
  const [email, setEmail]       = useState(user?.email || '');
  const [attachment, setAttachment] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const offline = net.isConnected === false;

  const pickAttachment = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      return Alert.alert('Permission needed', 'Allow photo access to attach a screenshot.');
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets[0];

    setUploading(true); setProgress(0);
    const up = await supportService.uploadAttachment(asset.uri, {
      kind: 'support-image',
      mimeType: asset.mimeType || 'image/jpeg',
      name: asset.fileName || 'screenshot.jpg',
      onProgress: setProgress,
    });
    setUploading(false);
    if (!up.success) return showError(up.message || 'Upload failed');
    setAttachment({ ...up, kind: 'screenshot' });
  };

  const submit = async () => {
    if (offline) return showError("You're offline. Connect to send your message.");
    if (subject.trim().length < 3) return showError('Please enter a subject.');
    if (message.trim().length < 10) return showError('Please describe your issue (10+ characters).');
    if (uploading) return showError('Please wait for the attachment to finish uploading.');

    setSubmitting(true);
    const res = await supportService.sendContact({
      subject: subject.trim(),
      category,
      message: message.trim(),
      email: email.trim(),
      attachments: attachment ? [attachment] : [],
      diagnostics: collectDiagnostics(net),
    });
    setSubmitting(false);

    if (res.success) {
      showSuccess(res.message || 'Your message has been sent.');
      setSubject(''); setMessage(''); setAttachment(null);
      setTimeout(() => navigation.navigate('MyTickets'), 900);
    } else {
      showError(res.message || 'Could not send your message.');
    }
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Contact Us" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {offline && (
            <View style={[S.offline, { backgroundColor: colors.iconChipBg }]}>
              <Ionicons name="cloud-offline-outline" size={15} color={colors.textMuted} />
              <Text style={[S.offlineText, { color: colors.textMuted }]}>You're offline — sending is disabled.</Text>
            </View>
          )}

          <Text style={[S.intro, { color: colors.textMuted }]}>
            Have a question or need help? Send us a message and we'll get back to you.
          </Text>

          <LabeledInput
            label="Subject" required colors={colors}
            placeholder="Brief summary" value={subject} onChangeText={setSubject} maxLength={200}
          />
          <CategoryChips value={category} onChange={setCategory} categories={CONTACT_CATEGORIES} colors={colors} />
          <LabeledInput
            label="Message" required colors={colors} multiline
            placeholder="Tell us what's going on…" value={message} onChangeText={setMessage} maxLength={8000}
          />
          <LabeledInput
            label="Email" colors={colors} keyboardType="email-address" autoCapitalize="none"
            placeholder="you@example.com" value={email} onChangeText={setEmail}
          />
          <AttachmentTile
            label="Add a screenshot (optional)" icon="image-outline"
            attachment={attachment} progress={progress} uploading={uploading}
            onPick={pickAttachment} onRemove={() => setAttachment(null)} colors={colors}
          />

          <DiagnosticsCard net={net} colors={colors} />
          <Text style={[S.userId, { color: colors.textDim }]}>User ID: {user?._id || '—'}</Text>

          <TouchableOpacity
            onPress={submit}
            disabled={submitting || uploading || offline}
            activeOpacity={0.85}
            style={[S.submit, { backgroundColor: colors.accent, opacity: (submitting || uploading || offline) ? 0.6 : 1 }]}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="send" size={18} color="#fff" /><Text style={S.submitText}>Send message</Text></>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {snackbar}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  offline: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 6 },
  offlineText: { fontSize: 12.5, marginLeft: 8 },
  intro: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  userId: { fontSize: 11.5, marginTop: 14, marginLeft: 2 },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 14, marginTop: 24 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700', marginLeft: 8 },
});
