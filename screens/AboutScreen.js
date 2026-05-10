// truevision/screens/AboutScreen.js
import { Alert, Linking, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow } from '../components/settings/SettingsRow';
import { useTheme } from '../context/ThemeContext';

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
const BUILD_NUM   = Constants.expoConfig?.android?.versionCode
                  || Constants.expoConfig?.ios?.buildNumber
                  || '—';

export default function AboutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const stub = (label) => Alert.alert(label, 'Coming soon.');
  const openUrl = (url) => Linking.openURL(url).catch(() => stub('Link'));

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="About TrueVision" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={S.hero}>
          <View style={S.logoCircle}>
            <Text style={S.logoText}>TV</Text>
          </View>
          <Text style={S.appName}>TrueVision</Text>
          <Text style={S.version}>Version {APP_VERSION}{BUILD_NUM !== '—' ? ` · build ${BUILD_NUM}` : ''}</Text>
        </View>

        <Section title="Legal">
          <SettingsRow icon="document-text-outline"     label="Terms of Service" onPress={() => stub('Terms of Service')} />
          <SettingsRow icon="shield-checkmark-outline"  label="Privacy Policy"   onPress={() => stub('Privacy Policy')} last />
        </Section>

        <Section title="Updates">
          <SettingsRow
            icon="refresh-outline" label="Check for Updates"
            sub={`You're on v${APP_VERSION}`}
            onPress={() => Alert.alert('Up to date', "You're on the latest version.")}
            last
          />
        </Section>

        <Section title="About">
          <SettingsRow
            icon="people-circle-outline" label="Team & Credits"
            sub="The people behind TrueVision"
            onPress={() => stub('Credits')}
          />
          <SettingsRow
            icon="logo-github" label="Open Source Licenses"
            onPress={() => stub('Licenses')}
            last
          />
        </Section>

        <Text style={S.copyright}>© {new Date().getFullYear()} TrueVision · Made with care</Text>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },

  hero: { alignItems: 'center', paddingTop: 30, paddingBottom: 8 },
  logoCircle: {
    width: 84, height: 84, borderRadius: 22,
    backgroundColor: '#0f172a',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#0f172a', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: 0.4 },
  appName:  { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  version:  { fontSize: 13, color: '#64748b', marginTop: 4 },

  copyright: {
    textAlign: 'center', color: '#94a3b8',
    fontSize: 12, fontWeight: '600', marginTop: 24,
  },
});
