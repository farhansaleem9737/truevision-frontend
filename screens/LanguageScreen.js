// truevision/screens/LanguageScreen.js
//
// Picks the app language. Saved both to AsyncStorage (offline-first) and to
// the backend preferences blob. The actual translation system isn't wired up
// yet — this screen stores the choice so it's ready when i18n lands.

import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section } from '../components/settings/SettingsRow';
import usePreferences from '../hooks/usePreferences';
import { useTheme } from '../context/ThemeContext';

const LANGUAGES = [
  { code: 'en', label: 'English',  native: 'English' },
  { code: 'ur', label: 'Urdu',     native: 'اُردُو' },
  { code: 'ar', label: 'Arabic',   native: 'العربية' },
  { code: 'hi', label: 'Hindi',    native: 'हिन्दी' },
  { code: 'tr', label: 'Turkish',  native: 'Türkçe' },
  { code: 'fr', label: 'French',   native: 'Français' },
];

export default function LanguageScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { prefs, setPath } = usePreferences();
  const current = prefs.language;

  const select = (code) => setPath('language', code);

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Language" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section title="App language">
          {LANGUAGES.map((lang, idx) => {
            const active = current === lang.code;
            const last   = idx === LANGUAGES.length - 1;
            return (
              <TouchableOpacity
                key={lang.code}
                onPress={() => select(lang.code)}
                activeOpacity={0.6}
                style={[S.row, !last && S.divider]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={S.label}>{lang.label}</Text>
                  <Text style={S.sub}>{lang.native}</Text>
                </View>
                {active ? (
                  <Ionicons name="checkmark-circle" size={22} color="#3b82f6" />
                ) : (
                  <View style={S.dot} />
                )}
              </TouchableOpacity>
            );
          })}
        </Section>

        <Text style={S.note}>
          Translation files ship in a future update. Your language choice is saved.
        </Text>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  row:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' },
  label: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  sub:   { fontSize: 13, color: '#64748b', marginTop: 2 },
  dot:   { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#cbd5e1' },
  note:  { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 22, paddingHorizontal: 30, lineHeight: 18 },
});
