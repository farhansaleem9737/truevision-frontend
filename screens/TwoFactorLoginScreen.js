// truevision/screens/TwoFactorLoginScreen.js
//
// Shown after a correct password when the account has 2FA enabled.
// Receives { pendingToken, email } from LoginScreen; exchanges
// pendingToken + emailed OTP for a real session via AuthContext.completeTwoFactor.
// Lives in the AUTH stack (user is not signed in yet).

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StatusBar, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import OtpInput from '../components/security/OtpInput';
import securityService from '../services/SecurityService';
import { useAuth } from '../context/AuthContext';

export default function TwoFactorLoginScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { completeTwoFactor } = useAuth();
  const otpRef = useRef(null);

  const { pendingToken, email } = route.params || {};

  const [verifying, setVerifying] = useState(false);
  const [error,     setError]     = useState('');
  const [resendIn,  setResendIn]  = useState(60);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const verify = async (code) => {
    if (verifying) return;
    setError('');
    setVerifying(true);
    const result = await completeTwoFactor(pendingToken, code);
    setVerifying(false);

    if (!result.success) {
      // Pending token expired → back to login for a fresh password entry.
      if (result.code === 'PENDING_EXPIRED') {
        Alert.alert('Sign-in expired', 'Please enter your password again.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      setError(result.message || 'Incorrect code');
      otpRef.current?.reset();
    }
    // On success AuthContext sets isAuthenticated → the root navigator
    // swaps to the app stack automatically. Nothing to do here.
  };

  const resend = async () => {
    if (resendIn > 0) return;
    const res = await securityService.resendLoginOtp(pendingToken);
    if (res.success) {
      setResendIn(60);
      setError('');
    } else if (res.code === 'PENDING_EXPIRED') {
      Alert.alert('Sign-in expired', 'Please enter your password again.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      setError(res.message || 'Could not resend the code');
    }
  };

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0b1220', '#101827', '#0b0b0f']} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[S.body, { paddingTop: insets.top + 24 }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={S.back}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>

          <View style={S.iconWrap}>
            <Ionicons name="shield-checkmark" size={34} color="#60a5fa" />
          </View>

          <Text style={S.title}>Two-factor authentication</Text>
          <Text style={S.sub}>
            Enter the 6-digit code we sent to{'\n'}
            <Text style={{ fontWeight: '800', color: '#e2e8f0' }}>{email || 'your email'}</Text>
          </Text>

          {!!error && (
            <View style={S.errorBox}>
              <Ionicons name="alert-circle" size={15} color="#f87171" />
              <Text style={S.errorText}>{error}</Text>
            </View>
          )}

          <View style={{ marginTop: 26, marginBottom: 18 }}>
            <OtpInput ref={otpRef} onComplete={verify} disabled={verifying} accent="#60a5fa" />
          </View>

          {verifying && <ActivityIndicator size="small" color="#60a5fa" />}

          <TouchableOpacity onPress={resend} disabled={resendIn > 0} style={{ marginTop: 18, padding: 8 }}>
            <Text style={[S.resend, { color: resendIn > 0 ? '#64748b' : '#60a5fa' }]}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>

          <Text style={S.hint}>
            The code expires in 10 minutes. Check spam if you don't see it.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0f' },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 28 },
  back: { position: 'absolute', left: 16, top: 60, zIndex: 5 },

  iconWrap: {
    width: 76, height: 76, borderRadius: 38, marginTop: 48,
    backgroundColor: 'rgba(96,165,250,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)',
  },
  title: { color: '#fff', fontSize: 21, fontWeight: '800', marginTop: 22 },
  sub:   { color: '#94a3b8', fontSize: 13.5, textAlign: 'center', marginTop: 10, lineHeight: 20 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 18,
  },
  errorText: { color: '#f87171', fontSize: 12.5, fontWeight: '600' },

  resend: { fontSize: 13.5, fontWeight: '800' },
  hint:   { color: '#475569', fontSize: 11.5, textAlign: 'center', marginTop: 22, lineHeight: 17 },
});
