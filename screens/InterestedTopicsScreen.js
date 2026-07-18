// truevision/screens/InterestedTopicsScreen.js
//
// Full-screen multi-select topic picker reached from Content Preferences →
// Interested Topics. Selections persist through usePreferences (optimistic +
// offline-first + revert-on-failure), which writes preferences.content.
// interestedTopics — the exact field the backend's personalized feed reads.
//
// The topic list MUST stay in sync with Backend/services/contentRanking.js
// AVAILABLE_TOPICS (and SettingsController TOPICS). A topic the user can pick
// but the engine can't score would be a silent dead setting.

import { useMemo, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StatusBar,
  StyleSheet, Animated, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ScreenHeader from '../components/settings/ScreenHeader';
import usePreferences from '../hooks/usePreferences';
import { useTheme } from '../context/ThemeContext';

// Canonical 18 topics + an icon each. Order matches the spec.
const TOPICS = [
  { key: 'Technology',   icon: 'hardware-chip-outline' },
  { key: 'Programming',  icon: 'code-slash-outline' },
  { key: 'AI',           icon: 'sparkles-outline' },
  { key: 'Education',    icon: 'school-outline' },
  { key: 'Business',     icon: 'briefcase-outline' },
  { key: 'Science',      icon: 'flask-outline' },
  { key: 'Finance',      icon: 'cash-outline' },
  { key: 'Islamic',      icon: 'moon-outline' },
  { key: 'History',      icon: 'hourglass-outline' },
  { key: 'Health',       icon: 'fitness-outline' },
  { key: 'Productivity', icon: 'checkmark-done-outline' },
  { key: 'News',         icon: 'newspaper-outline' },
  { key: 'Travel',       icon: 'airplane-outline' },
  { key: 'Nature',       icon: 'leaf-outline' },
  { key: 'Sports',       icon: 'football-outline' },
  { key: 'Engineering',  icon: 'construct-outline' },
  { key: 'Mathematics',  icon: 'calculator-outline' },
  { key: 'Languages',    icon: 'language-outline' },
];

const TopicChip = ({ topic, icon, active, onPress, colors, isDark }) => {
  const scale = useMemo(() => new Animated.Value(1), []);
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };
  return (
    <Animated.View style={{ transform: [{ scale }], width: '48%' }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={press}
        style={[
          S.chip,
          {
            backgroundColor: active ? colors.accent : (isDark ? 'rgba(255,255,255,0.05)' : '#fff'),
            borderColor: active ? colors.accent : colors.divider,
          },
        ]}
      >
        <View style={[
          S.chipIcon,
          { backgroundColor: active ? 'rgba(255,255,255,0.2)' : (isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9') },
        ]}>
          <Ionicons name={icon} size={18} color={active ? '#fff' : colors.textMuted} />
        </View>
        <Text style={[S.chipText, { color: active ? '#fff' : colors.text }]} numberOfLines={1}>
          {topic}
        </Text>
        {active && (
          <Ionicons name="checkmark-circle" size={17} color="#fff" style={{ marginLeft: 'auto' }} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function InterestedTopicsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { prefs, setPath, saving } = usePreferences();

  const selected = prefs.content.interestedTopics || [];
  const [error, setError] = useState('');

  const toggle = useCallback(async (topic) => {
    const has = selected.includes(topic);
    const next = has ? selected.filter((t) => t !== topic) : [...selected, topic];
    setError('');
    const res = await setPath('content.interestedTopics', next);
    if (res && res.success === false) {
      setError(res.message || 'Could not save — will retry when online');
    }
  }, [selected, setPath]);

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader
        title="Interested Topics"
        onBack={() => navigation.goBack()}
        right={saving ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom }}>
        <Text style={[S.lead, { color: colors.textMuted }]}>
          Pick topics you want more of. We'll prioritize them in your feed when
          Personalized Recommendations is on.
        </Text>

        <View style={[S.counter, { borderColor: colors.divider }]}>
          <Ionicons name="sparkles" size={14} color={colors.accent} />
          <Text style={[S.counterText, { color: colors.text }]}>
            {selected.length} selected
          </Text>
        </View>

        {!!error && (
          <View style={[S.errorBar, { backgroundColor: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2' }]}>
            <Ionicons name="cloud-offline-outline" size={15} color={colors.danger} />
            <Text style={[S.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        <View style={S.grid}>
          {TOPICS.map((t) => (
            <TopicChip
              key={t.key}
              topic={t.key}
              icon={t.icon}
              active={selected.includes(t.key)}
              onPress={() => toggle(t.key)}
              colors={colors}
              isDark={isDark}
            />
          ))}
        </View>

        {selected.length === 0 && (
          <Text style={[S.hint, { color: colors.textMuted }]}>
            No topics selected yet — your feed will stay general until you pick some.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  lead: { fontSize: 13.5, lineHeight: 20, marginBottom: 14 },

  counter: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 14,
  },
  counterText: { fontSize: 12.5, fontWeight: '700' },

  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12,
  },
  errorText: { fontSize: 12.5, fontWeight: '600', flex: 1 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', rowGap: 12,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.4, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 12,
    minHeight: 56,
  },
  chipIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '700', flexShrink: 1 },

  hint: { fontSize: 12.5, textAlign: 'center', marginTop: 20, lineHeight: 18 },
});
