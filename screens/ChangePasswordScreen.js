// truevision/screens/ChangePasswordScreen.js
//
// Authenticated password change (Settings → Security → Change Password).
//
// Flow: current + new + confirm → PATCH /api/security/password. On success
// the backend revokes EVERY token (tokenInvalidBefore = now), so we show a
// confirmation and log out locally — the user signs back in with the new
// password, exactly like Instagram's behavior.

import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StatusBar, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import securityService from '../services/SecurityService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Mirrors Backend/controllers/SecurityController PASSWORD_RULES.
const RULES = [
  { key: 'len',    label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'letter', label: 'Contains a letter',     test: (p) => /[a-zA-Z]/.test(p) },
  { key: 'digit',  label: 'Contains a number',     test: (p) => /\d/.test(p) },
];

const Field = ({ label, value, onChangeText, show, onToggleShow, colors, isDark, ...rest }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={[S.label, { color: colors.textMuted }]}>{label}</Text>
    <View style={[
      S.inputRow,
      { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff', borderColor: colors.divider },
    ]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textMuted}
        style={[S.input, { color: colors.text }]}
        {...rest}
      />
      <TouchableOpacity onPress={onToggleShow} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  </View>
);

export default function ChangePasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { logout } = useAuth();

  const [current, setCurrent] = useState('');
  const [next,    setNext]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const ruleState = useMemo(() => RULES.map((r) => ({ ...r, ok: r.test(next) })), [next]);
  const rulesOk   = ruleState.every((r) => r.ok);
  const matches   = next.length > 0 && next === confirm;
  const differs   = next !== current || next.length === 0;
  const canSave   = current.length > 0 && rulesOk && matches && differs && !saving;

  const onSubmit = async () => {
    if (!canSave) return;
    setError('');
    setSaving(true);
    const res = await securityService.changePassword(current, next);
    setSaving(false);

    if (!res.success) {
      setError(res.message || 'Could not change password');
      return;
    }

    // Backend revoked every token, including this device's. Confirm, then
    // clear local state so the navigator returns to the login screen.
    Alert.alert(
      'Password changed',
      'You\'ve been signed out everywhere for security. Sign in again with your new password.',
      [{ text: 'OK', onPress: async () => { await logout(); } }],
      { cancelable: false },
    );
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Change Password" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          {!!error && (
            <View style={[S.errorBox, { backgroundColor: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2' }]}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={[S.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          )}

          <Field
            label="CURRENT PASSWORD"
            value={current} onChangeText={setCurrent}
            show={showCur} onToggleShow={() => setShowCur((v) => !v)}
            placeholder="Enter current password"
            colors={colors} isDark={isDark}
          />
          <Field
            label="NEW PASSWORD"
            value={next} onChangeText={setNext}
            show={showNew} onToggleShow={() => setShowNew((v) => !v)}
            placeholder="Enter new password"
            colors={colors} isDark={isDark}
          />
          <Field
            label="CONFIRM NEW PASSWORD"
            value={confirm} onChangeText={setConfirm}
            show={showNew} onToggleShow={() => setShowNew((v) => !v)}
            placeholder="Repeat new password"
            colors={colors} isDark={isDark}
          />

          {/* Live strength checklist */}
          <View style={[S.rulesCard, { backgroundColor: colors.card, borderColor: colors.divider }]}>
            {ruleState.map((r) => (
              <View key={r.key} style={S.ruleRow}>
                <Ionicons
                  name={r.ok ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={r.ok ? '#22c55e' : colors.textMuted}
                />
                <Text style={[S.ruleText, { color: r.ok ? colors.text : colors.textMuted }]}>{r.label}</Text>
              </View>
            ))}
            <View style={S.ruleRow}>
              <Ionicons
                name={matches ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={matches ? '#22c55e' : colors.textMuted}
              />
              <Text style={[S.ruleText, { color: matches ? colors.text : colors.textMuted }]}>Passwords match</Text>
            </View>
            {!differs && (
              <View style={S.ruleRow}>
                <Ionicons name="close-circle" size={16} color={colors.danger} />
                <Text style={[S.ruleText, { color: colors.danger }]}>New password must be different</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={onSubmit}
            disabled={!canSave}
            activeOpacity={0.85}
            style={[S.submit, { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.45 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={S.submitText}>Update Password</Text>
            )}
          </TouchableOpacity>

          <Text style={[S.note, { color: colors.textMuted }]}>
            Changing your password signs you out of every device, including this one.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 13, fontSize: 15 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
  },
  errorText: { fontSize: 13, fontWeight: '600', flex: 1 },

  rulesCard: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 12,
    padding: 14, marginTop: 4, marginBottom: 20, gap: 8,
  },
  ruleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { fontSize: 13, fontWeight: '600' },

  submit: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  submitText: { color: '#fff', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 17, paddingHorizontal: 20 },
});
