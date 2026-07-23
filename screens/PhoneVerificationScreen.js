// truevision/screens/PhoneVerificationScreen.js
//
// Security → Phone. Two-step flow:
//   1. Pick a country code + enter the number → POST /security/send-phone-otp
//   2. Enter the 6-digit code               → POST /security/verify-phone
//
// If the server has no SMS provider configured it delivers the code to the
// account email instead — the response's `channel` tells us which, and the
// UI says so honestly.
//
// Also handles edit (re-run the flow with a new number) and remove.

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StatusBar, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Alert, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import OtpInput from '../components/security/OtpInput';
import securityService from '../services/SecurityService';
import { useTheme } from '../context/ThemeContext';
import { useConfirm } from '../components/common/ConfirmProvider';

// Compact country-code list — ordered by app audience, searchable.
const COUNTRIES = [
  { code: '+92',  name: 'Pakistan',             flag: '🇵🇰' },
  { code: '+91',  name: 'India',                flag: '🇮🇳' },
  { code: '+1',   name: 'United States/Canada', flag: '🇺🇸' },
  { code: '+44',  name: 'United Kingdom',       flag: '🇬🇧' },
  { code: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+966', name: 'Saudi Arabia',         flag: '🇸🇦' },
  { code: '+880', name: 'Bangladesh',           flag: '🇧🇩' },
  { code: '+90',  name: 'Türkiye',              flag: '🇹🇷' },
  { code: '+62',  name: 'Indonesia',            flag: '🇮🇩' },
  { code: '+60',  name: 'Malaysia',             flag: '🇲🇾' },
  { code: '+49',  name: 'Germany',              flag: '🇩🇪' },
  { code: '+33',  name: 'France',               flag: '🇫🇷' },
  { code: '+61',  name: 'Australia',            flag: '🇦🇺' },
  { code: '+86',  name: 'China',                flag: '🇨🇳' },
  { code: '+81',  name: 'Japan',                flag: '🇯🇵' },
  { code: '+234', name: 'Nigeria',              flag: '🇳🇬' },
  { code: '+20',  name: 'Egypt',                flag: '🇪🇬' },
  { code: '+27',  name: 'South Africa',         flag: '🇿🇦' },
];

export default function PhoneVerificationScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const confirm = useConfirm();
  const otpRef = useRef(null);

  // Existing verified number (passed from SecurityScreen for display).
  const existing = route?.params?.phone || null; // { number, countryCode }

  const [step,        setStep]        = useState('enter');   // 'enter' | 'code'
  const [country,     setCountry]     = useState(COUNTRIES[0]);
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [number,      setNumber]      = useState('');
  const [sending,     setSending]     = useState(false);
  const [verifying,   setVerifying]   = useState(false);
  const [removingNum, setRemovingNum] = useState(false);
  const [error,       setError]       = useState('');
  const [channelMsg,  setChannelMsg]  = useState('');
  const [resendIn,    setResendIn]    = useState(0);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const digitsOnly = number.replace(/\D/g, '');
  const canSend = digitsOnly.length >= 6 && digitsOnly.length <= 14 && !sending;

  const sendCode = async () => {
    if (!canSend) return;
    setError('');
    setSending(true);
    const res = await securityService.sendPhoneOtp(country.code, digitsOnly);
    setSending(false);
    if (!res.success) { setError(res.message || 'Could not send the code'); return; }
    setChannelMsg(res.message || '');
    setStep('code');
    setResendIn(60);
  };

  const verify = async (code) => {
    if (verifying) return;
    setError('');
    setVerifying(true);
    const res = await securityService.verifyPhone(code);
    setVerifying(false);
    if (!res.success) {
      setError(res.message || 'Incorrect code');
      otpRef.current?.reset();
      return;
    }
    Alert.alert('Phone verified', `${country.code} ${digitsOnly} is now linked to your account.`, [
      { text: 'Done', onPress: () => navigation.navigate({ name: 'Security', params: { refresh: Date.now() }, merge: true }) },
    ]);
  };

  const removeNumber = async () => {
    const ok = await confirm({
      title:       'Remove phone number',
      message:     `Remove ${existing?.countryCode || ''} ${existing?.number || ''} from your account?`,
      confirmText: 'Remove',
      destructive: true,
      icon:        'call-outline',
    });
    if (!ok) return;
    setRemovingNum(true);
    const res = await securityService.removePhone();
    setRemovingNum(false);
    if (res.success) {
      navigation.navigate({ name: 'Security', params: { refresh: Date.now() }, merge: true });
    } else {
      Alert.alert('Could not remove', res.message || 'Try again later');
    }
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader
        title={existing?.number ? 'Update Phone' : 'Verify Phone'}
        onBack={() => (step === 'code' ? setStep('enter') : navigation.goBack())}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          {!!existing?.number && step === 'enter' && (
            <View style={[S.existingCard, { backgroundColor: colors.card, borderColor: colors.divider }]}>
              <Ionicons name="call" size={18} color="#22c55e" />
              <Text style={[S.existingText, { color: colors.text }]}>
                {existing.countryCode} {existing.number} · verified
              </Text>
              <TouchableOpacity onPress={removeNumber} disabled={removingNum}>
                {removingNum
                  ? <ActivityIndicator size="small" color={colors.danger} />
                  : <Text style={[S.removeText, { color: colors.danger }]}>Remove</Text>}
              </TouchableOpacity>
            </View>
          )}

          {!!error && (
            <View style={[S.errorBox, { backgroundColor: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2' }]}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={[S.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          )}

          {step === 'enter' ? (
            <>
              <Text style={[S.label, { color: colors.textMuted }]}>PHONE NUMBER</Text>
              <View style={S.phoneRow}>
                <TouchableOpacity
                  onPress={() => setPickerOpen(true)}
                  activeOpacity={0.8}
                  style={[S.ccButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff', borderColor: colors.divider }]}
                >
                  <Text style={{ fontSize: 16 }}>{country.flag}</Text>
                  <Text style={[S.ccText, { color: colors.text }]}>{country.code}</Text>
                  <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                </TouchableOpacity>
                <View style={[S.numBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff', borderColor: colors.divider }]}>
                  <TextInput
                    value={number}
                    onChangeText={setNumber}
                    keyboardType="phone-pad"
                    placeholder="3001234567"
                    placeholderTextColor={colors.textMuted}
                    style={[S.numInput, { color: colors.text }]}
                    maxLength={16}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={sendCode}
                disabled={!canSend}
                activeOpacity={0.85}
                style={[S.submit, { backgroundColor: colors.accent, opacity: canSend ? 1 : 0.45 }]}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={S.submitText}>Send Verification Code</Text>}
              </TouchableOpacity>

              <Text style={[S.note, { color: colors.textMuted }]}>
                We'll send a 6-digit code to confirm this number belongs to you.
              </Text>
            </>
          ) : (
            <>
              <Text style={[S.codeTitle, { color: colors.text }]}>Enter the 6-digit code</Text>
              {!!channelMsg && (
                <Text style={[S.channelMsg, { color: colors.textMuted }]}>{channelMsg}</Text>
              )}

              <View style={{ marginVertical: 22 }}>
                <OtpInput ref={otpRef} onComplete={verify} disabled={verifying} />
              </View>

              {verifying && <ActivityIndicator size="small" color={colors.accent} style={{ marginBottom: 12 }} />}

              <TouchableOpacity
                onPress={sendCode}
                disabled={resendIn > 0 || sending}
                style={{ alignSelf: 'center', padding: 8 }}
              >
                <Text style={{
                  color: resendIn > 0 ? colors.textMuted : colors.accent,
                  fontWeight: '700', fontSize: 13.5,
                }}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={S.pickerBackdrop}>
          <View style={[S.pickerSheet, { backgroundColor: colors.card }]}>
            <View style={S.pickerHeader}>
              <Text style={[S.pickerTitle, { color: colors.text }]}>Select country</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(c) => c.code + c.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { setCountry(item); setPickerOpen(false); }}
                  style={[S.pickerRow, { borderBottomColor: colors.divider }]}
                >
                  <Text style={{ fontSize: 18 }}>{item.flag}</Text>
                  <Text style={[S.pickerName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[S.pickerCode, { color: colors.textMuted }]}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.7, marginBottom: 8 },

  existingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 18,
  },
  existingText: { flex: 1, fontSize: 13.5, fontWeight: '700' },
  removeText:   { fontSize: 13, fontWeight: '800' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
  },
  errorText: { fontSize: 13, fontWeight: '600', flex: 1 },

  phoneRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  ccButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 12,
    paddingHorizontal: 12, height: 50,
  },
  ccText: { fontSize: 15, fontWeight: '700' },
  numBox: {
    flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12,
    paddingHorizontal: 14, height: 50, justifyContent: 'center',
  },
  numInput: { fontSize: 16, fontWeight: '600' },

  submit: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 17, paddingHorizontal: 20 },

  codeTitle:  { fontSize: 17, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  channelMsg: { fontSize: 12.5, textAlign: 'center', marginTop: 8, lineHeight: 18, paddingHorizontal: 12 },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
  },
  pickerTitle: { fontSize: 16, fontWeight: '800' },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerName: { flex: 1, fontSize: 14.5, fontWeight: '600' },
  pickerCode: { fontSize: 14, fontWeight: '700' },
});
