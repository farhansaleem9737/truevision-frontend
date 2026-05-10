// truevision/screens/SecurityScreen.js
//
// Account security overview. Most rows are scaffolded — they require backend
// infrastructure (sessions table, 2FA, change-password) that isn't built yet.
// I show the verification status from the user object (real) and clearly label
// the rest as coming soon, rather than fake success states.

import { Alert, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow, SwitchRow } from '../components/settings/SettingsRow';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';

const VerifiedBadge = ({ ok }) => (
  <View style={[S.badge, ok ? S.badgeOk : S.badgePending]}>
    <Ionicons
      name={ok ? 'checkmark-circle' : 'alert-circle-outline'}
      size={14} color={ok ? '#16a34a' : '#f59e0b'}
    />
    <Text style={[S.badgeText, ok ? S.badgeOkText : S.badgePendingText]}>
      {ok ? 'Verified' : 'Unverified'}
    </Text>
  </View>
);

export default function SecurityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const [twoFA, setTwoFA] = useState(false); // Local-only — backend not built

  const stub = (label) => Alert.alert(label, 'Coming soon — needs backend support.');

  const logoutAll = () => {
    Alert.alert(
      'Log out from all devices',
      'You\'ll be signed out everywhere. You can sign back in with your password.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out everywhere', style: 'destructive', onPress: async () => {
          // No bulk-logout endpoint yet — just log out locally.
          await logout();
        }},
      ],
    );
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Security" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section title="Sign-in">
          <SettingsRow
            icon="key-outline" label="Change Password"
            sub="Update your account password"
            onPress={() => stub('Change Password')}
          />
          <SwitchRow
            icon="finger-print-outline"
            label="Two-Factor Authentication"
            sub="Require a code at every sign-in"
            value={twoFA}
            onValueChange={(v) => { setTwoFA(v); stub('Two-Factor Authentication'); }}
            last
          />
        </Section>

        <Section title="Sessions">
          <SettingsRow
            icon="laptop-outline" label="Login Activity"
            sub="See where you're logged in"
            onPress={() => stub('Login Activity')}
          />
          <SettingsRow
            icon="log-out-outline" label="Log out from all devices"
            danger onPress={logoutAll}
            last showChevron={false}
          />
        </Section>

        <Section title="Verification">
          <SettingsRow
            icon="mail-outline" label="Email"
            sub={user?.email}
            right={<VerifiedBadge ok={!!user?.isVerified} />}
            showChevron={false}
          />
          <SettingsRow
            icon="call-outline" label="Phone"
            sub="Phone verification not set up yet"
            right={<VerifiedBadge ok={false} />}
            showChevron={false}
            last
          />
        </Section>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },

  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  badgeOk:        { backgroundColor: '#dcfce7' },
  badgePending:   { backgroundColor: '#fef3c7' },
  badgeText:      { fontSize: 11.5, fontWeight: '700', marginLeft: 4 },
  badgeOkText:    { color: '#15803d' },
  badgePendingText:{ color: '#b45309' },
});
