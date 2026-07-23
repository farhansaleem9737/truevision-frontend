// truevision/screens/HelpSupportScreen.js
//
// Help & Support hub. Each row routes to a real screen — Help Center (FAQ),
// Contact Us, Report a Problem, Terms and Privacy (shared with the About
// module). Theme-aware; also surfaces "My Requests" so users can track tickets.

import { useRef } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow } from '../components/settings/SettingsRow';
import { useTheme } from '../context/ThemeContext';
import { APP_VERSION } from '../utils/diagnostics';

export default function HelpSupportScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Hidden admin gate: 7 quick taps on the version string opens the admin login
  // (concealed — never linked in normal UI).
  const tapCount = useRef(0);
  const tapTimer = useRef(null);
  const onVersionTap = () => {
    tapCount.current += 1;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1500);
    if (tapCount.current >= 7) {
      tapCount.current = 0;
      navigation.navigate('AdminLogin');
    }
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Help & Support" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Section title="Get help">
          <SettingsRow
            icon="help-buoy-outline" label="Help Center"
            sub="Search FAQs and common issues"
            onPress={() => navigation.navigate('HelpCenter')}
          />
          <SettingsRow
            icon="mail-outline" label="Contact Us"
            sub="Send us a message"
            onPress={() => navigation.navigate('ContactUs')}
          />
          <SettingsRow
            icon="bug-outline" label="Report a Problem"
            sub="Let us know what went wrong"
            onPress={() => navigation.navigate('ReportProblem')}
            last
          />
        </Section>

        <Section title="Your requests">
          <SettingsRow
            icon="receipt-outline" label="My Requests"
            sub="Track your tickets and replies"
            onPress={() => navigation.navigate('MyTickets')}
            last
          />
        </Section>

        <Section title="Your content">
          <SettingsRow
            icon="shield-checkmark-outline" label="Uploads under review"
            sub="Blocked or pending videos + request a review"
            onPress={() => navigation.navigate('MyReviews')}
            last
          />
        </Section>

        <Section title="Legal">
          <SettingsRow
            icon="document-text-outline" label="Terms & Conditions"
            onPress={() => navigation.navigate('Terms')}
          />
          <SettingsRow
            icon="shield-checkmark-outline" label="Privacy Policy"
            onPress={() => navigation.navigate('PrivacyPolicy')}
            last
          />
        </Section>

        <TouchableOpacity activeOpacity={1} onPress={onVersionTap}>
          <Text style={[S.version, { color: colors.textDim }]}>TrueVision v{APP_VERSION}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  version: { textAlign: 'center', fontSize: 13, fontWeight: '600', marginTop: 26 },
});
