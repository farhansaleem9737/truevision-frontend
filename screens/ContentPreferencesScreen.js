// truevision/screens/ContentPreferencesScreen.js
//
// Content-Preferences hub. Every toggle persists through usePreferences
// (optimistic local update → PUT /api/users/preferences → revert on failure,
// with an AsyncStorage cache so it works offline until synced). The Interested
// Topics row opens a dedicated multi-select screen.
//
// Each of these settings is now actually consumed:
//   • Auto-play / HD-on-Wi-Fi / Data Saver → ReelCard playback + quality
//   • Hide Sensitive Content / Personalized Recommendations → backend feed

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView, StatusBar, StyleSheet, Text, View, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow, SwitchRow } from '../components/settings/SettingsRow';
import usePreferences from '../hooks/usePreferences';
import { useTheme } from '../context/ThemeContext';

// Lightweight in-screen snackbar (success / error) — avoids Alert popups.
const Snackbar = ({ text, tone, colors }) => {
  const y = useRef(new Animated.Value(60)).current;
  useEffect(() => {
    Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    return () => { y.setValue(60); };
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  const bg = tone === 'error' ? colors.danger : '#16a34a';
  return (
    <Animated.View style={[S.snack, { backgroundColor: bg, transform: [{ translateY: y }] }]}>
      <Ionicons name={tone === 'error' ? 'alert-circle' : 'checkmark-circle'} size={16} color="#fff" />
      <Text style={S.snackText}>{text}</Text>
    </Animated.View>
  );
};

export default function ContentPreferencesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { prefs, setPath } = usePreferences();
  const c = prefs.content;

  const [snack, setSnack] = useState(null); // { text, tone }
  const snackTimer = useRef(null);

  const flash = useCallback((text, tone = 'success') => {
    setSnack({ text, tone });
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => setSnack(null), 1800);
  }, []);

  useEffect(() => () => { if (snackTimer.current) clearTimeout(snackTimer.current); }, []);

  // Wrap every toggle so a failed sync surfaces as an error snackbar (the hook
  // has already reverted the optimistic change under the hood).
  const set = (key, label) => async (v) => {
    const res = await setPath(`content.${key}`, v);
    if (res && res.success === false) {
      flash(res.message || `Couldn't save ${label}`, 'error');
    } else {
      flash('Saved', 'success');
    }
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Content Preferences" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Section title="Topics">
          <SettingsRow
            icon="sparkles-outline" label="Interested Topics"
            sub={c.interestedTopics.length
              ? `${c.interestedTopics.length} selected · ${c.interestedTopics.slice(0, 3).join(', ')}${c.interestedTopics.length > 3 ? '…' : ''}`
              : 'Pick what you want more of'}
            onPress={() => navigation.navigate('InterestedTopics')}
            last
          />
        </Section>

        <Section title="Playback">
          <SwitchRow
            icon="play-circle-outline" label="Auto-play Videos"
            sub="Play automatically as you scroll"
            value={c.autoplay} onValueChange={set('autoplay', 'auto-play')}
          />
          <SwitchRow
            icon="wifi-outline" label="HD Playback on Wi-Fi only"
            sub="Stream lower quality on cellular"
            value={c.hdOnWifi} onValueChange={set('hdOnWifi', 'HD on Wi-Fi')}
          />
          <SwitchRow
            icon="cellular-outline" label="Data Saver"
            sub="Reduce video bitrate everywhere"
            value={c.dataSaver} onValueChange={set('dataSaver', 'Data Saver')}
            last
          />
        </Section>

        <Section title="Recommendations">
          <SwitchRow
            icon="shield-half-outline" label="Hide Sensitive Content"
            sub="Filter out flagged and graphic videos"
            value={c.hideSensitive} onValueChange={set('hideSensitive', 'Hide Sensitive')}
          />
          <SwitchRow
            icon="trending-up-outline" label="Personalized Recommendations"
            sub="Use your activity to tailor your feed"
            value={c.personalizedRecs} onValueChange={set('personalizedRecs', 'Personalization')}
            last
          />
        </Section>

        <Text style={[S.note, { color: colors.textMuted }]}>
          Changes save instantly and sync across your devices. Turn off
          Personalized Recommendations to see a generic trending feed.
        </Text>
      </ScrollView>

      {snack && <Snackbar text={snack.text} tone={snack.tone} colors={colors} />}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  note: { fontSize: 12, textAlign: 'center', marginTop: 22, paddingHorizontal: 30, lineHeight: 18 },
  snack: {
    position: 'absolute', left: 16, right: 16, bottom: 22,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  snackText: { color: '#fff', fontSize: 13.5, fontWeight: '700', flex: 1 },
});
