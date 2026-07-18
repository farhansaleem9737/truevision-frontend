// truevision/screens/legal/TermsScreen.js
//
// Full Terms of Service. Fetches GET /api/legal/terms (offline-cached), renders
// rich sections (paragraphs, lists, links), shows version + last-updated, and
// supports live search that filters to matching sections.

import { useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/settings/ScreenHeader';
import LegalContent from '../../components/legal/LegalContent';
import { useTheme } from '../../context/ThemeContext';
import useCachedResource from '../../hooks/useCachedResource';
import appService from '../../services/AppService';

// Flatten a section's text so search can scan headings + body in one string.
const sectionText = (s) => {
  const parts = [s.heading];
  for (const b of s.body || []) {
    if (b.text) parts.push(b.text);
    if (b.items) parts.push(b.items.join(' '));
    if (b.label) parts.push(b.label);
  }
  return parts.join(' ').toLowerCase();
};

export default function TermsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const { data, loading, error, offline, fromCache, refetch } =
    useCachedResource('legal:terms', appService.getTerms, { pickData: (r) => r.document });

  const filtered = useMemo(() => {
    const sections = data?.sections || [];
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => sectionText(s).includes(q));
  }, [data, query]);

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title={data?.title || 'Terms of Service'} onBack={() => navigation.goBack()} />

      {loading && !data ? (
        <View style={S.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : error && !data ? (
        <View style={S.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textDim} />
          <Text style={[S.errText, { color: colors.textMuted }]}>Couldn't load the Terms.</Text>
          <TouchableOpacity onPress={refetch} style={[S.retryBtn, { backgroundColor: colors.accent }]}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* Meta */}
          <View style={S.metaWrap}>
            <View style={[S.badge, { backgroundColor: colors.iconChipBg }]}>
              <Text style={[S.badgeText, { color: colors.textMuted }]}>v{data?.version}</Text>
            </View>
            <Text style={[S.meta, { color: colors.textDim }]}>Last updated {data?.lastUpdated}</Text>
          </View>

          {offline && (
            <View style={[S.offline, { backgroundColor: colors.iconChipBg }]}>
              <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
              <Text style={[S.offlineText, { color: colors.textMuted }]}>
                Offline{fromCache ? ' · showing saved copy' : ''}
              </Text>
            </View>
          )}

          {/* Search */}
          <View style={[S.search, { backgroundColor: colors.card, borderColor: colors.divider }]}>
            <Ionicons name="search" size={18} color={colors.textDim} />
            <TextInput
              style={[S.searchInput, { color: colors.text }]}
              placeholder="Search terms…"
              placeholderTextColor={colors.textDim}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textDim} />
              </TouchableOpacity>
            )}
          </View>

          {!query && data?.intro ? (
            <Text style={[S.intro, { color: colors.textMuted }]}>{data.intro}</Text>
          ) : null}

          {filtered.length === 0 ? (
            <Text style={[S.noResults, { color: colors.textDim }]}>No sections match “{query}”.</Text>
          ) : (
            filtered.map((s) => (
              <View key={s.id} style={[S.sectionCard, { backgroundColor: colors.card }]}>
                <Text style={[S.heading, { color: colors.text }]}>{s.heading}</Text>
                <LegalContent blocks={s.body} colors={colors} />
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errText: { fontSize: 14, marginTop: 12, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '700' },

  metaWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, marginRight: 10 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  meta: { fontSize: 12 },

  offline: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  offlineText: { fontSize: 12, marginLeft: 6 },

  search: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 14, paddingHorizontal: 12, height: 44,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },

  intro: { fontSize: 14, lineHeight: 22, paddingHorizontal: 18, marginTop: 16 },
  noResults: { textAlign: 'center', marginTop: 40, fontSize: 14 },

  sectionCard: { marginHorizontal: 16, marginTop: 14, borderRadius: 14, padding: 16 },
  heading: { fontSize: 15.5, fontWeight: '800', marginBottom: 10 },
});
