// truevision/screens/moderation/RequestReviewScreen.js
//
// Creator submits an appeal against a blocked/rejected upload. Route:
// 'RequestReview', params: { video, onSubmitted? }.

import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import videoService from '../../services/VideoService';

export default function RequestReviewScreen({ route, navigation }) {
  const { colors } = useTheme();
  const video = route.params?.video || {};
  const onSubmitted = route.params?.onSubmitted;

  const [reason, setReason]           = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes]             = useState('');
  const [links, setLinks]             = useState('');
  const [busy, setBusy]               = useState(false);

  const submit = async () => {
    if (!reason.trim() && !description.trim()) {
      Alert.alert('Add a reason', 'Please tell us why this video should be reviewed.');
      return;
    }
    setBusy(true);
    const res = await videoService.submitReviewRequest(video._id, {
      reason: reason.trim(),
      description: description.trim(),
      notes: notes.trim(),
      links: links.split(/[\n,]/).map((l) => l.trim()).filter(Boolean),
    });
    setBusy(false);

    if (res?.success) {
      onSubmitted?.(res.reviewRequest);
      Alert.alert(
        'Review requested',
        'Your request was submitted. We’ll notify you with the decision.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } else {
      Alert.alert('Could not submit', res?.message || 'Please try again.');
    }
  };

  const Field = ({ label, value, onChangeText, placeholder, multiline, hint }) => (
    <View style={{ marginBottom: 18 }}>
      <Text style={[S.label, { color: colors.text }]}>{label}</Text>
      {hint ? <Text style={[S.hint, { color: colors.textDim }]}>{hint}</Text> : null}
      <TextInput
        style={[
          S.input,
          multiline && S.inputMulti,
          { backgroundColor: colors.card, color: colors.text, borderColor: colors.divider },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        multiline={multiline}
      />
    </View>
  );

  return (
    <SafeAreaView style={[S.root, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: colors.text }]}>Request Review</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={[S.intro, { color: colors.textMuted }]}>
            Tell us why this video belongs on TrueVision. A moderator will review it manually.
          </Text>

          {Field({ label: 'Reason', value: reason, onChangeText: setReason, placeholder: 'e.g. Educational tutorial, not entertainment' })}
          {Field({ label: 'Description', value: description, onChangeText: setDescription, placeholder: 'Explain what your video teaches or informs about…', multiline: true })}
          {Field({ label: 'Supporting notes', value: notes, onChangeText: setNotes, placeholder: 'Anything else the reviewer should know (optional)', multiline: true })}
          {Field({ label: 'Links', value: links, onChangeText: setLinks, placeholder: 'https://…  (one per line, optional)', multiline: true, hint: 'Optional supporting links, comma or newline separated.' })}

          <TouchableOpacity
            style={[S.submit, { backgroundColor: colors.accent }, busy && { opacity: 0.6 }]}
            onPress={submit}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="send" size={17} color="#fff" />
                <Text style={S.submitText}>Submit request</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  intro:       { fontSize: 14, lineHeight: 20, marginBottom: 22 },
  label:       { fontSize: 14.5, fontWeight: '800', marginBottom: 6 },
  hint:        { fontSize: 12, marginBottom: 8 },
  input:       { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  inputMulti:  { minHeight: 96, textAlignVertical: 'top' },
  submit:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 14, marginTop: 10 },
  submitText:  { color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 8 },
});
