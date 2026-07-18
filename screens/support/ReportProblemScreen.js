// truevision/screens/support/ReportProblemScreen.js
//
// Complete bug-report form → POST /api/support/report. Captures a screenshot
// and/or a screen recording (uploaded to Cloudinary with progress), optional
// console/crash logs (from the in-memory log buffer), and auto device/app/OS/
// network diagnostics. Loading, success/error snackbars, offline guard.

import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  StyleSheet, Switch, Text, TouchableOpacity, View,
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
import { getLogs } from '../../utils/logBuffer';
import { REPORT_CATEGORIES } from '../../constants/supportCategories';

export default function ReportProblemScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const net = useNetworkStatus();
  const { showSuccess, showError, node: snackbar } = useSnackbar();

  const [subject, setSubject]   = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('bug');
  const [shot, setShot]         = useState(null);      // screenshot attachment
  const [recording, setRecording] = useState(null);    // screen-recording attachment
  const [includeLogs, setIncludeLogs] = useState(true);

  const [shotProg, setShotProg] = useState(0);
  const [recProg, setRecProg]   = useState(0);
  const [shotUp, setShotUp]     = useState(false);
  const [recUp, setRecUp]       = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const offline = net.isConnected === false;

  const pickMedia = async ({ video, onSet, setUp, setProg, kind }) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      return Alert.alert('Permission needed', `Allow media access to attach a ${video ? 'recording' : 'screenshot'}.`);
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: video ? ['videos'] : ['images'],
      quality: video ? undefined : 0.7,
      videoMaxDuration: 120,
    });
    if (result.canceled) return;
    const asset = result.assets[0];

    setUp(true); setProg(0);
    const up = await supportService.uploadAttachment(asset.uri, {
      kind: video ? 'support-video' : 'support-image',
      mimeType: asset.mimeType || (video ? 'video/mp4' : 'image/jpeg'),
      name: asset.fileName || (video ? 'recording.mp4' : 'screenshot.jpg'),
      onProgress: setProg,
    });
    setUp(false);
    if (!up.success) return showError(up.message || 'Upload failed');
    onSet({ ...up, kind });
  };

  const submit = async () => {
    if (offline) return showError("You're offline. Connect to submit your report.");
    if (description.trim().length < 10) return showError('Please describe the problem (10+ characters).');
    if (shotUp || recUp) return showError('Please wait for uploads to finish.');

    const attachments = [shot, recording].filter(Boolean);

    setSubmitting(true);
    const res = await supportService.sendReport({
      subject: subject.trim() || 'Bug report',
      description: description.trim(),
      category,
      email: user?.email || '',
      attachments,
      logs: includeLogs ? getLogs() : '',
      diagnostics: collectDiagnostics(net),
    });
    setSubmitting(false);

    if (res.success) {
      showSuccess(res.message || 'Your report has been submitted. Thank you!');
      setSubject(''); setDescription(''); setShot(null); setRecording(null);
      setTimeout(() => navigation.navigate('MyTickets'), 900);
    } else {
      showError(res.message || 'Could not submit your report.');
    }
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Report a Problem" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {offline && (
            <View style={[S.offline, { backgroundColor: colors.iconChipBg }]}>
              <Ionicons name="cloud-offline-outline" size={15} color={colors.textMuted} />
              <Text style={[S.offlineText, { color: colors.textMuted }]}>You're offline — submitting is disabled.</Text>
            </View>
          )}

          <Text style={[S.intro, { color: colors.textMuted }]}>
            Found a bug? Describe it and attach a screenshot or screen recording so we can reproduce it faster.
          </Text>

          <LabeledInput
            label="Title" colors={colors}
            placeholder="Short title (optional)" value={subject} onChangeText={setSubject} maxLength={200}
          />
          <CategoryChips value={category} onChange={setCategory} categories={REPORT_CATEGORIES} colors={colors} />
          <LabeledInput
            label="What went wrong?" required colors={colors} multiline
            placeholder="Steps to reproduce, what you expected, what happened…"
            value={description} onChangeText={setDescription} maxLength={8000}
          />

          <AttachmentTile
            label="Attach screenshot" icon="image-outline"
            attachment={shot} progress={shotProg} uploading={shotUp}
            onPick={() => pickMedia({ video: false, onSet: setShot, setUp: setShotUp, setProg: setShotProg, kind: 'screenshot' })}
            onRemove={() => setShot(null)} colors={colors}
          />
          <AttachmentTile
            label="Attach screen recording" icon="videocam-outline"
            attachment={recording} progress={recProg} uploading={recUp}
            onPick={() => pickMedia({ video: true, onSet: setRecording, setUp: setRecUp, setProg: setRecProg, kind: 'recording' })}
            onRemove={() => setRecording(null)} colors={colors}
          />

          {/* Console / crash logs */}
          <View style={[S.logsRow, { backgroundColor: colors.card, borderColor: colors.divider }]}>
            <Ionicons name="terminal-outline" size={18} color={colors.textMuted} />
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[S.logsTitle, { color: colors.text }]}>Attach console logs</Text>
              <Text style={[S.logsSub, { color: colors.textDim }]}>Recent app logs help us debug crashes</Text>
            </View>
            <Switch
              value={includeLogs}
              onValueChange={setIncludeLogs}
              trackColor={{ true: colors.accent, false: colors.divider }}
              thumbColor="#fff"
            />
          </View>

          <DiagnosticsCard net={net} colors={colors} />

          <TouchableOpacity
            onPress={submit}
            disabled={submitting || shotUp || recUp || offline}
            activeOpacity={0.85}
            style={[S.submit, { backgroundColor: colors.accent, opacity: (submitting || shotUp || recUp || offline) ? 0.6 : 1 }]}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="bug" size={18} color="#fff" /><Text style={S.submitText}>Submit report</Text></>}
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
  logsRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginTop: 18 },
  logsTitle: { fontSize: 14, fontWeight: '600' },
  logsSub: { fontSize: 12, marginTop: 2 },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 14, marginTop: 24 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700', marginLeft: 8 },
});
