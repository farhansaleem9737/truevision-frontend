// truevision/screens/CheckForUpdatesScreen.js
//
// Real update checker. Compares the installed version/build (expo-constants)
// with the latest advertised by GET /api/app/version, shows "What's New" from
// GET /api/app/changelog, and offers an Update action:
//   • If expo-updates is present → OTA: checkForUpdateAsync → fetch → reload.
//   • Otherwise → open the platform store listing.
// Loading / error / retry / offline are all handled.

import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Linking, Platform, ScrollView, StatusBar, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import ScreenHeader from '../components/settings/ScreenHeader';
import { useTheme } from '../context/ThemeContext';
import useCachedResource from '../hooks/useCachedResource';
import appService from '../services/AppService';

const CLIENT_VERSION = Constants.expoConfig?.version || '1.0.0';
const CLIENT_BUILD = Number(
  Constants.expoConfig?.android?.versionCode ??
  Constants.expoConfig?.ios?.buildNumber ??
  1,
);

// Numeric semver compare (major.minor.patch). Returns 1 if a>b, -1 if a<b, 0 eq.
const parseV = (v) => String(v || '0').split('.').map((n) => parseInt(n, 10) || 0);
const cmpVersion = (a, b) => {
  const pa = parseV(a), pb = parseV(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
};

export default function CheckForUpdatesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [updating, setUpdating] = useState(false);

  const version = useCachedResource('app:version', appService.getVersion);
  const changelog = useCachedResource('app:changelog', appService.getChangelog, {
    pickData: (r) => r.releases,
  });

  const latest = version.data?.latestClient;
  const loading = (version.loading && !version.data);
  const error = version.error && !version.data;

  const updateAvailable = !!latest && (
    cmpVersion(latest.version, CLIENT_VERSION) > 0 ||
    (cmpVersion(latest.version, CLIENT_VERSION) === 0 && (latest.buildNumber || 0) > CLIENT_BUILD)
  );

  const refetch = () => { version.refetch(); changelog.refetch(); };

  const doUpdate = useCallback(async () => {
    setUpdating(true);
    // 1. OTA path (expo-updates) — production standalone builds.
    try {
      // eslint-disable-next-line global-require, import/no-unresolved
      const Updates = require('expo-updates');
      if (Updates?.checkForUpdateAsync) {
        const check = await Updates.checkForUpdateAsync();
        if (check?.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
          return; // app restarts into the new bundle
        }
      }
    } catch (_) { /* expo-updates unavailable — fall through to store */ }

    // 2. Store fallback.
    const url = Platform.OS === 'ios' ? latest?.storeUrl?.ios : latest?.storeUrl?.android;
    if (url) await Linking.openURL(url).catch(() => {});
    setUpdating(false);
  }, [latest]);

  const latestRelease = changelog.data?.[0];

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Check for Updates" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={S.center}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[S.checking, { color: colors.textMuted }]}>Checking for updates…</Text>
          </View>
        ) : error ? (
          <View style={S.center}>
            <Ionicons name="cloud-offline-outline" size={44} color={colors.textDim} />
            <Text style={[S.errText, { color: colors.textMuted }]}>
              {version.offline ? "You're offline. Connect to check for updates." : "Couldn't check for updates."}
            </Text>
            <TouchableOpacity onPress={refetch} style={[S.primaryBtn, { backgroundColor: colors.accent }]}>
              <Text style={S.primaryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Status hero */}
            <View style={S.hero}>
              <View style={[
                S.statusCircle,
                { backgroundColor: updateAvailable ? '#f59e0b22' : '#22c55e22' },
              ]}>
                <Ionicons
                  name={updateAvailable ? 'arrow-up-circle' : 'checkmark-circle'}
                  size={54}
                  color={updateAvailable ? '#f59e0b' : '#22c55e'}
                />
              </View>
              <Text style={[S.heroTitle, { color: colors.text }]}>
                {updateAvailable ? 'Update available' : "You're up to date"}
              </Text>
              <Text style={[S.heroSub, { color: colors.textMuted }]}>
                {updateAvailable
                  ? `Version ${latest.version} is available`
                  : `You're on the latest version (v${CLIENT_VERSION})`}
              </Text>
            </View>

            {/* Version card */}
            <View style={[S.card, { backgroundColor: colors.card }]}>
              <View style={S.cardRow}>
                <Text style={[S.rowLabel, { color: colors.textMuted }]}>Installed</Text>
                <Text style={[S.rowValue, { color: colors.text }]}>v{CLIENT_VERSION} ({CLIENT_BUILD})</Text>
              </View>
              {latest && (
                <View style={[S.cardRow, S.rowBorder, { borderTopColor: colors.divider }]}>
                  <Text style={[S.rowLabel, { color: colors.textMuted }]}>Latest</Text>
                  <Text style={[S.rowValue, { color: colors.text }]}>
                    v{latest.version}{latest.buildNumber ? ` (${latest.buildNumber})` : ''}
                  </Text>
                </View>
              )}
              {latest?.releaseDate && (
                <View style={[S.cardRow, S.rowBorder, { borderTopColor: colors.divider }]}>
                  <Text style={[S.rowLabel, { color: colors.textMuted }]}>Release date</Text>
                  <Text style={[S.rowValue, { color: colors.text }]}>{latest.releaseDate}</Text>
                </View>
              )}
            </View>

            {/* What's New */}
            {updateAvailable && latestRelease && (
              <View style={S.whatsNew}>
                <Text style={[S.sectionTitle, { color: colors.textMuted }]}>What's New in v{latestRelease.version}</Text>
                <View style={[S.card, { backgroundColor: colors.card, padding: 16 }]}>
                  {(latestRelease.highlights || []).map((h, i) => (
                    <View key={i} style={S.bulletRow}>
                      <Ionicons name="sparkles-outline" size={15} color={colors.accent} style={{ marginTop: 2 }} />
                      <Text style={[S.bulletText, { color: colors.textMuted }]}>{h}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Action */}
            <View style={S.actionWrap}>
              {updateAvailable ? (
                <TouchableOpacity
                  onPress={doUpdate}
                  disabled={updating}
                  style={[S.primaryBtn, { backgroundColor: colors.accent, opacity: updating ? 0.7 : 1 }]}
                >
                  {updating
                    ? <ActivityIndicator color="#fff" />
                    : <><Ionicons name="download-outline" size={18} color="#fff" /><Text style={[S.primaryText, { marginLeft: 8 }]}>Update now</Text></>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={refetch}
                  style={[S.secondaryBtn, { borderColor: colors.divider }]}
                >
                  <Ionicons name="refresh" size={18} color={colors.text} />
                  <Text style={[S.secondaryText, { color: colors.text }]}>Check again</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 30 },
  checking: { marginTop: 14, fontSize: 14 },
  errText: { marginTop: 14, marginBottom: 18, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  hero: { alignItems: 'center', paddingTop: 30, paddingBottom: 10, paddingHorizontal: 24 },
  statusCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 20, fontWeight: '800' },
  heroSub: { fontSize: 14, marginTop: 6, textAlign: 'center' },

  card: { marginHorizontal: 16, marginTop: 18, borderRadius: 14, overflow: 'hidden' },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '700' },

  whatsNew: { marginTop: 22 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginLeft: 20, marginBottom: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21, marginLeft: 10 },

  actionWrap: { paddingHorizontal: 16, marginTop: 26 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 14 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 14, borderWidth: 1 },
  secondaryText: { fontSize: 15, fontWeight: '700', marginLeft: 8 },
});
