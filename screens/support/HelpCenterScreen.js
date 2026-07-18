// truevision/screens/support/HelpCenterScreen.js
//
// Searchable Help Center. Fetches GET /api/support/faqs (offline-cached),
// supports search, category filtering, expandable articles (accordion),
// "Popular articles" and "Recently viewed" (persisted per device).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation, Platform, ScrollView, StatusBar, StyleSheet, Text,
  TextInput, TouchableOpacity, UIManager, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/settings/ScreenHeader';
import { useTheme } from '../../context/ThemeContext';
import useCachedResource from '../../hooks/useCachedResource';
import supportService from '../../services/SupportService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RECENT_KEY = '@truevision:faq:recent';
const RECENT_MAX = 8;

function ArticleItem({ article, open, onToggle, colors }) {
  return (
    <View style={[S.article, { borderBottomColor: colors.divider }]}>
      <TouchableOpacity style={S.articleHead} activeOpacity={0.7} onPress={() => onToggle(article)}>
        <Text style={[S.question, { color: colors.text }]}>{article.question}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textDim} />
      </TouchableOpacity>
      {open && <Text style={[S.answer, { color: colors.textMuted }]}>{article.answer}</Text>}
    </View>
  );
}

export default function HelpCenterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null); // null = all
  const [openId, setOpenId] = useState(null);
  const [recentIds, setRecentIds] = useState([]);

  const { data, loading, error, offline, fromCache, refetch } =
    useCachedResource('support:faqs', () => supportService.getFaqs());

  const categories = data?.categories || [];
  const articles = data?.articles || [];
  const popular = data?.popular || [];

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then((raw) => { if (raw) setRecentIds(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  const recordRecent = useCallback((id) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_MAX);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const toggle = useCallback((article) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((cur) => (cur === article.id ? null : article.id));
    recordRecent(article.id);
  }, [recordRecent]);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    let list = articles;
    if (category) list = list.filter((a) => a.category === category);
    if (q) list = list.filter((a) => a.question.toLowerCase().includes(q) || a.answer.toLowerCase().includes(q));
    return list;
  }, [articles, category, q]);

  const recentArticles = useMemo(
    () => recentIds.map((id) => articles.find((a) => a.id === id)).filter(Boolean),
    [recentIds, articles],
  );

  const showDiscovery = !q && !category; // popular + recently viewed only on the landing view

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Help Center" onBack={() => navigation.goBack()} />

      {loading && !data ? (
        <View style={S.center}><Ionicons name="help-buoy-outline" size={40} color={colors.textDim} /><Text style={[S.dim, { color: colors.textMuted }]}>Loading help…</Text></View>
      ) : error && !data ? (
        <View style={S.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textDim} />
          <Text style={[S.dim, { color: colors.textMuted }]}>Couldn't load the Help Center.</Text>
          <TouchableOpacity onPress={refetch} style={[S.retryBtn, { backgroundColor: colors.accent }]}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* Search */}
          <View style={[S.search, { backgroundColor: colors.card, borderColor: colors.divider }]}>
            <Ionicons name="search" size={18} color={colors.textDim} />
            <TextInput
              style={[S.searchInput, { color: colors.text }]}
              placeholder="Search help articles…"
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

          {offline && (
            <View style={[S.offline, { backgroundColor: colors.iconChipBg }]}>
              <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
              <Text style={[S.offlineText, { color: colors.textMuted }]}>Offline{fromCache ? ' · showing saved help' : ''}</Text>
            </View>
          )}

          {/* Category chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chips}
            keyboardShouldPersistTaps="handled">
            <Chip label="All" active={!category} onPress={() => setCategory(null)} colors={colors} />
            {categories.map((c) => (
              <Chip key={c.key} label={c.label} active={category === c.key} onPress={() => setCategory(c.key)} colors={colors} />
            ))}
          </ScrollView>

          {/* Discovery rails (only on the unfiltered landing view) */}
          {showDiscovery && popular.length > 0 && (
            <View style={S.block}>
              <Text style={[S.sectionTitle, { color: colors.textMuted }]}>Popular articles</Text>
              <View style={[S.card, { backgroundColor: colors.card }]}>
                {popular.map((a) => (
                  <ArticleItem key={a.id} article={a} open={openId === a.id} onToggle={toggle} colors={colors} />
                ))}
              </View>
            </View>
          )}

          {showDiscovery && recentArticles.length > 0 && (
            <View style={S.block}>
              <Text style={[S.sectionTitle, { color: colors.textMuted }]}>Recently viewed</Text>
              <View style={[S.card, { backgroundColor: colors.card }]}>
                {recentArticles.map((a) => (
                  <ArticleItem key={a.id} article={a} open={openId === a.id} onToggle={toggle} colors={colors} />
                ))}
              </View>
            </View>
          )}

          {/* Main list */}
          <View style={S.block}>
            <Text style={[S.sectionTitle, { color: colors.textMuted }]}>
              {q ? `Results (${filtered.length})` : category ? categories.find((c) => c.key === category)?.label : 'All articles'}
            </Text>
            {filtered.length === 0 ? (
              <View style={[S.card, { backgroundColor: colors.card, padding: 24, alignItems: 'center' }]}>
                <Ionicons name="search-outline" size={28} color={colors.textDim} />
                <Text style={[S.noResults, { color: colors.textMuted }]}>No articles found. Try Contact Us.</Text>
                <TouchableOpacity onPress={() => navigation.navigate('ContactUs')} style={[S.retryBtn, { backgroundColor: colors.accent, marginTop: 12 }]}>
                  <Text style={S.retryText}>Contact Us</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[S.card, { backgroundColor: colors.card }]}>
                {filtered.map((a) => (
                  <ArticleItem key={a.id} article={a} open={openId === a.id} onToggle={toggle} colors={colors} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const Chip = ({ label, active, onPress, colors }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={[S.chip, { backgroundColor: active ? colors.accent : colors.card, borderColor: active ? colors.accent : colors.divider }]}
  >
    <Text style={[S.chipText, { color: active ? '#fff' : colors.textMuted }]}>{label}</Text>
  </TouchableOpacity>
);

const S = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dim: { fontSize: 14, marginTop: 12, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 14 },
  retryText: { color: '#fff', fontWeight: '700' },

  search: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 14, paddingHorizontal: 12, height: 44,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },

  offline: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  offlineText: { fontSize: 12, marginLeft: 6 },

  chips: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 13, fontWeight: '600' },

  block: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 },
  card: { borderRadius: 14, overflow: 'hidden' },

  article: { paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  articleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  question: { flex: 1, fontSize: 14.5, fontWeight: '600', marginRight: 10 },
  answer: { fontSize: 13.5, lineHeight: 21, paddingBottom: 14 },
  noResults: { fontSize: 14, marginTop: 10, textAlign: 'center' },
});
