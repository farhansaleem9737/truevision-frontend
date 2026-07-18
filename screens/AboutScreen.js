// truevision/screens/AboutScreen.js
//
// About hub: app logo + version, a live "App Information" card (environment,
// backend version, DB + API status pulled from GET /api/app/info with
// offline caching), and navigation into Terms, Privacy, Updates, Credits and
// Licenses. Loading / error / retry / offline states are all handled by the
// useCachedResource hook.

import { useEffect, useRef } from 'react';
import {
  ActivityIndicator, Animated, Image, ScrollView, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow } from '../components/settings/SettingsRow';
import { useTheme } from '../context/ThemeContext';
import useCachedResource from '../hooks/useCachedResource';
import appService from '../services/AppService';

const CLIENT_VERSION = Constants.expoConfig?.version || '1.0.0';
const CLIENT_BUILD =
  Constants.expoConfig?.android?.versionCode ??
  Constants.expoConfig?.ios?.buildNumber ??
  '1';
const RUNTIME_ENV = __DEV__ ? 'development' : 'production';

// Green / amber / red dot for a health value.
const StatusDot = ({ ok, warn }) => {
  const color = ok ? '#22c55e' : warn ? '#f59e0b' : '#ef4444';
  return <View style={[S.dot, { backgroundColor: color }]} />;
};

const InfoRow = ({ label, value, status, colors, last }) => (
  <View style={[S.infoRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }]}>
    <Text style={[S.infoLabel, { color: colors.textMuted }]}>{label}</Text>
    <View style={S.infoValueWrap}>
      {status !== undefined && <StatusDot ok={status === 'ok'} warn={status === 'warn'} />}
      <Text style={[S.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  </View>
);

export default function AboutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const { data: info, loading, error, offline, fromCache, refetch, refreshing } =
    useCachedResource('app:info', appService.getInfo);

  // Subtle fade + rise on mount.
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const dbHealthy  = info?.database?.healthy;
  const apiHealthy = info?.api?.status === 'operational';

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="About TrueVision" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Animated.View style={[S.hero, { opacity: fade, transform: [{ translateY: rise }] }]}>
          <View style={[S.logoCircle, { backgroundColor: colors.card }]}>
            <Image source={require('../assets/images/tv-icon.png')} style={S.logo} resizeMode="contain" />
          </View>
          <Text style={[S.appName, { color: colors.text }]}>TrueVision</Text>
          <Text style={[S.version, { color: colors.textMuted }]}>
            Version {CLIENT_VERSION} · Build {String(CLIENT_BUILD)}
          </Text>
          <View style={[S.envChip, { backgroundColor: colors.iconChipBg }]}>
            <Text style={[S.envText, { color: colors.textMuted }]}>{RUNTIME_ENV.toUpperCase()}</Text>
          </View>
        </Animated.View>

        {/* App Information (live) */}
        <View style={S.section}>
          <View style={S.sectionHead}>
            <Text style={[S.sectionTitle, { color: colors.textMuted }]}>App Information</Text>
            {refreshing && <ActivityIndicator size="small" color={colors.textMuted} />}
          </View>

          <View style={[S.card, { backgroundColor: colors.card }]}>
            {offline && (
              <View style={[S.offlineBar, { backgroundColor: colors.iconChipBg }]}>
                <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
                <Text style={[S.offlineText, { color: colors.textMuted }]}>
                  Offline{fromCache ? ' · showing saved info' : ''}
                </Text>
              </View>
            )}

            {loading && !info ? (
              <View style={S.centerPad}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : error && !info ? (
              <View style={S.centerPad}>
                <Ionicons name="alert-circle-outline" size={26} color={colors.textDim} />
                <Text style={[S.errorText, { color: colors.textMuted }]}>Couldn't load app info.</Text>
                <TouchableOpacity onPress={refetch} style={[S.retryBtn, { backgroundColor: colors.accent }]}>
                  <Text style={S.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <InfoRow label="Environment" value={info?.environment || RUNTIME_ENV} colors={colors} />
                <InfoRow label="App Version" value={`${CLIENT_VERSION} (${String(CLIENT_BUILD)})`} colors={colors} />
                <InfoRow label="Backend Version" value={info?.backendVersion || '—'} colors={colors} />
                <InfoRow
                  label="Database"
                  value={info?.database?.status || 'unknown'}
                  status={dbHealthy ? 'ok' : 'bad'}
                  colors={colors}
                />
                <InfoRow
                  label="API"
                  value={info?.api?.status || 'unknown'}
                  status={apiHealthy ? 'ok' : 'bad'}
                  colors={colors}
                  last
                />
              </>
            )}
          </View>
        </View>

        <Section title="Legal">
          <SettingsRow icon="document-text-outline"    label="Terms of Service" onPress={() => navigation.navigate('Terms')} />
          <SettingsRow icon="shield-checkmark-outline" label="Privacy Policy"   onPress={() => navigation.navigate('PrivacyPolicy')} last />
        </Section>

        <Section title="Updates">
          <SettingsRow
            icon="refresh-outline" label="Check for Updates"
            sub={`You're on v${CLIENT_VERSION}`}
            onPress={() => navigation.navigate('CheckForUpdates')}
            last
          />
        </Section>

        <Section title="About">
          <SettingsRow
            icon="people-circle-outline" label="Team & Credits"
            sub="The people behind TrueVision"
            onPress={() => navigation.navigate('TeamCredits')}
          />
          <SettingsRow
            icon="logo-github" label="Open Source Licenses"
            onPress={() => navigation.navigate('Licenses')}
            last
          />
        </Section>

        <Text style={[S.copyright, { color: colors.textDim }]}>
          © {new Date().getFullYear()} TrueVision · Made with care
        </Text>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },

  hero: { alignItems: 'center', paddingTop: 26, paddingBottom: 8 },
  logoCircle: {
    width: 88, height: 88, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  logo: { width: 60, height: 60 },
  appName: { fontSize: 22, fontWeight: '900' },
  version: { fontSize: 13, marginTop: 4 },
  envChip: { marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  envText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },

  section: { paddingTop: 22, paddingHorizontal: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginLeft: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  card: { borderRadius: 14, overflow: 'hidden' },

  offlineBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  offlineText: { fontSize: 12, marginLeft: 6 },

  centerPad: { alignItems: 'center', paddingVertical: 26 },
  errorText: { fontSize: 13, marginTop: 8, marginBottom: 12 },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13 },
  infoLabel: { fontSize: 14 },
  infoValueWrap: { flexDirection: 'row', alignItems: 'center' },
  infoValue: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },

  copyright: { textAlign: 'center', fontSize: 12, fontWeight: '600', marginTop: 24 },
});
