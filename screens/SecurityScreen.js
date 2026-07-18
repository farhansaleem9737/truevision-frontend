// truevision/screens/SecurityScreen.js
//
// Account security hub — fully wired to /api/security/*:
//   • Change Password  → ChangePasswordScreen
//   • Two-Factor Auth  → email-OTP-verified enable/disable (inline sheet)
//   • Login Activity   → LoginActivityScreen
//   • Log out from all devices → DELETE /security/logout-all
//   • Email badge      → live user.isVerified
//   • Phone            → PhoneVerificationScreen (add / edit / remove)

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, ScrollView, StatusBar, StyleSheet, Text, View,
  Modal, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow, SwitchRow } from '../components/settings/SettingsRow';
import OtpInput from '../components/security/OtpInput';
import securityService from '../services/SecurityService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const VerifiedBadge = ({ ok, pendingLabel = 'Unverified' }) => (
  <View style={[S.badge, ok ? S.badgeOk : S.badgePending]}>
    <Ionicons
      name={ok ? 'checkmark-circle' : 'alert-circle-outline'}
      size={14} color={ok ? '#16a34a' : '#f59e0b'}
    />
    <Text style={[S.badgeText, ok ? S.badgeOkText : S.badgePendingText]}>
      {ok ? 'Verified' : pendingLabel}
    </Text>
  </View>
);

export default function SecurityScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user, logout } = useAuth();
  const otpRef = useRef(null);

  const [settings,   setSettings]   = useState(null);   // server snapshot
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  // 2FA OTP sheet state
  const [twoFaSheet,   setTwoFaSheet]   = useState(null); // null | { targetEnabled: bool }
  const [twoFaSending, setTwoFaSending] = useState(false);
  const [twoFaBusy,    setTwoFaBusy]    = useState(false);
  const [twoFaError,   setTwoFaError]   = useState('');
  const [resendIn,     setResendIn]     = useState(0);

  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const load = useCallback(async (viaRefresh = false) => {
    if (!viaRefresh) setLoading(true);
    setError('');
    const res = await securityService.getSettings();
    if (res.success) setSettings(res.settings);
    else setError(res.message || 'Could not load security settings');
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Refetch on focus + when a child screen bounces back with { refresh }.
  useFocusEffect(useCallback(() => { load(); }, [load, route?.params?.refresh]));

  // Resend countdown for the 2FA sheet
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // ── 2FA flow: toggle → send OTP → sheet → verify → flipped ───────────────
  const startTwoFaChange = async (targetEnabled) => {
    if (twoFaSending) return;
    setTwoFaSending(true);
    setTwoFaError('');
    const res = await securityService.sendTwoFactorOtp(targetEnabled ? 'enable-2fa' : 'disable-2fa');
    setTwoFaSending(false);
    if (!res.success) {
      Alert.alert('Could not send code', res.message || 'Try again shortly.');
      return;
    }
    setTwoFaSheet({ targetEnabled });
    setResendIn(60);
  };

  const confirmTwoFa = async (code) => {
    if (twoFaBusy || !twoFaSheet) return;
    setTwoFaBusy(true);
    setTwoFaError('');
    const res = await securityService.setTwoFactor(twoFaSheet.targetEnabled, code);
    setTwoFaBusy(false);
    if (!res.success) {
      setTwoFaError(res.message || 'Incorrect code');
      otpRef.current?.reset();
      return;
    }
    setTwoFaSheet(null);
    setSettings((s) => ({ ...s, twoFactorEnabled: res.twoFactorEnabled }));
  };

  const resendTwoFa = async () => {
    if (resendIn > 0 || !twoFaSheet) return;
    const res = await securityService.sendTwoFactorOtp(twoFaSheet.targetEnabled ? 'enable-2fa' : 'disable-2fa');
    if (res.success) { setResendIn(60); setTwoFaError(''); }
    else setTwoFaError(res.message || 'Could not resend');
  };

  // ── Logout everywhere ─────────────────────────────────────────────────────
  const logoutAll = () => {
    Alert.alert(
      'Log out from all devices',
      'Every signed-in device will be logged out immediately, including this one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out everywhere', style: 'destructive',
          onPress: async () => {
            setLoggingOutAll(true);
            const res = await securityService.logoutAll(false);
            setLoggingOutAll(false);
            if (res.success) {
              await logout(); // clears local state → login screen
            } else {
              Alert.alert('Could not log out everywhere', res.message || 'Try again later.');
            }
          },
        },
      ],
    );
  };

  const emailVerified = settings ? settings.emailVerified : !!user?.isVerified;
  const phoneVerified = !!settings?.phoneVerified;
  const phoneDisplay  = settings?.phoneNumber
    ? `${settings.phoneCountryCode || ''} ${settings.phoneNumber}`
    : 'Add and verify a phone number';

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Security" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={colors.accent} colors={[colors.accent]}
          />
        }
      >
        {!!error && (
          <TouchableOpacity onPress={() => load()} style={[S.errorBar, { backgroundColor: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2' }]}>
            <Ionicons name="alert-circle" size={15} color={colors.danger} />
            <Text style={[S.errorBarText, { color: colors.danger }]}>{error} — tap to retry</Text>
          </TouchableOpacity>
        )}

        <Section title="Sign-in">
          <SettingsRow
            icon="key-outline" label="Change Password"
            sub="Update your account password"
            onPress={() => navigation.navigate('ChangePassword')}
          />
          <SwitchRow
            icon="finger-print-outline"
            label="Two-Factor Authentication"
            sub={settings?.twoFactorEnabled
              ? 'On — a code is required at every sign-in'
              : 'Require a code at every sign-in'}
            value={!!settings?.twoFactorEnabled}
            onValueChange={(v) => startTwoFaChange(v)}
            disabled={loading || twoFaSending}
            last
          />
        </Section>

        <Section title="Sessions">
          <SettingsRow
            icon="laptop-outline" label="Login Activity"
            sub="See where you're logged in"
            onPress={() => navigation.navigate('LoginActivity')}
          />
          <SettingsRow
            icon="log-out-outline"
            label={loggingOutAll ? 'Logging out…' : 'Log out from all devices'}
            danger onPress={logoutAll}
            last showChevron={false}
          />
        </Section>

        <Section title="Verification">
          <SettingsRow
            icon="mail-outline" label="Email"
            sub={settings?.email || user?.email}
            right={<VerifiedBadge ok={emailVerified} />}
            showChevron={false}
          />
          <SettingsRow
            icon="call-outline" label="Phone"
            sub={phoneDisplay}
            right={<VerifiedBadge ok={phoneVerified} pendingLabel={settings?.phoneNumber ? 'Unverified' : 'Not set'} />}
            onPress={() => navigation.navigate('PhoneVerification', {
              phone: settings?.phoneNumber
                ? { number: settings.phoneNumber, countryCode: settings.phoneCountryCode }
                : null,
            })}
            last
          />
        </Section>

        {loading && !settings && (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        )}
      </ScrollView>

      {/* ── 2FA verification sheet ─────────────────────────────────────── */}
      <Modal
        visible={!!twoFaSheet}
        transparent animationType="slide"
        onRequestClose={() => !twoFaBusy && setTwoFaSheet(null)}
      >
        <View style={S.sheetBackdrop}>
          <View style={[S.sheet, { backgroundColor: colors.card }]}>
            <View style={S.sheetHeader}>
              <Text style={[S.sheetTitle, { color: colors.text }]}>
                {twoFaSheet?.targetEnabled ? 'Turn on two-factor' : 'Turn off two-factor'}
              </Text>
              <TouchableOpacity onPress={() => !twoFaBusy && setTwoFaSheet(null)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[S.sheetSub, { color: colors.textMuted }]}>
              Enter the 6-digit code we emailed to {settings?.email || user?.email}
            </Text>

            {!!twoFaError && (
              <Text style={[S.sheetError, { color: colors.danger }]}>{twoFaError}</Text>
            )}

            <View style={{ marginVertical: 20 }}>
              <OtpInput ref={otpRef} onComplete={confirmTwoFa} disabled={twoFaBusy} />
            </View>

            {twoFaBusy && <ActivityIndicator size="small" color={colors.accent} style={{ marginBottom: 10 }} />}

            <TouchableOpacity onPress={resendTwoFa} disabled={resendIn > 0} style={{ alignSelf: 'center', padding: 6 }}>
              <Text style={{ color: resendIn > 0 ? colors.textMuted : colors.accent, fontWeight: '700', fontSize: 13 }}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },

  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  badgeOk:          { backgroundColor: '#dcfce7' },
  badgePending:     { backgroundColor: '#fef3c7' },
  badgeText:        { fontSize: 11.5, fontWeight: '700', marginLeft: 4 },
  badgeOkText:      { color: '#15803d' },
  badgePendingText: { color: '#b45309' },

  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  errorBarText: { fontSize: 12.5, fontWeight: '600', flex: 1 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 22, paddingTop: 16, paddingBottom: 34,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle:  { fontSize: 17, fontWeight: '800' },
  sheetSub:    { fontSize: 13, marginTop: 10, lineHeight: 19 },
  sheetError:  { fontSize: 12.5, fontWeight: '700', marginTop: 10 },
});
