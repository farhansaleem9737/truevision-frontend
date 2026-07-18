// truevision/screens/LanguageScreen.js
//
// App language picker. Fully wired to the i18n system:
//   • Radio selection with a smooth animated check.
//   • Instant apply (text updates app-wide the moment you tap).
//   • Loading state on the row being applied.
//   • Error + Retry banner when the server sync fails (choice stays cached).
//   • RTL languages flip layout on selection (the app reloads once for that).
// All copy comes from translation keys — nothing here is hardcoded English.

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, I18nManager, ScrollView, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section } from '../components/settings/SettingsRow';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { fontFamilyFor } from '../i18n/fonts';

// Animated selection indicator — spring-scales in when a row becomes active.
function SelectIndicator({ active, loading, colors }) {
  const scale = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 120,
    }).start();
  }, [active, scale]);

  if (loading) return <ActivityIndicator size="small" color={colors.accent} />;

  return (
    <View style={S.indicatorWrap}>
      {/* empty radio ring (fades as the check scales in) */}
      <Animated.View
        style={[
          S.radioRing,
          { borderColor: colors.divider, opacity: scale.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }], opacity: scale }}>
        <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
      </Animated.View>
    </View>
  );
}

export default function LanguageScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { language, languages, changing, error, setLanguage, retry } = useLanguage();

  const [pending, setPending] = useState(null);
  const rtl = I18nManager.isRTL;

  const onSelect = async (code) => {
    if (code === language || changing) return;
    setPending(code);
    await setLanguage(code);
    setPending(null);
  };

  const align = { textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title={t('language.title')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section title={t('language.appLanguage')}>
          {languages.map((lang, idx) => {
            const active  = language === lang.code;
            const loading = changing && pending === lang.code;
            const last    = idx === languages.length - 1;
            return (
              <TouchableOpacity
                key={lang.code}
                onPress={() => onSelect(lang.code)}
                activeOpacity={0.6}
                disabled={changing}
                style={[
                  S.row,
                  !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[S.label, align, { color: colors.text }]}>{lang.label}</Text>
                  <Text
                    style={[S.sub, align, { color: colors.textMuted, fontFamily: fontFamilyFor(lang.code) }]}
                  >
                    {lang.native}
                  </Text>
                </View>
                <SelectIndicator active={active} loading={loading} colors={colors} />
              </TouchableOpacity>
            );
          })}
        </Section>

        {/* Error + retry — the choice is already cached locally; this only
            reports that the account-level sync didn't go through. */}
        {error ? (
          <View style={[S.errorCard, { backgroundColor: colors.iconChipDanger, borderColor: colors.danger }]}>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.danger} />
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[S.errorTitle, { color: colors.danger }]}>{t('language.errorTitle')}</Text>
              <Text style={[S.errorBody, { color: colors.textMuted }]}>{t('language.errorBody')}</Text>
            </View>
            <TouchableOpacity
              onPress={retry}
              disabled={changing}
              style={[S.retryBtn, { backgroundColor: colors.danger, opacity: changing ? 0.6 : 1 }]}
            >
              {changing
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={S.retryText}>{t('common.retry')}</Text>}
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={[S.note, { color: colors.textDim }]}>{t('language.note')}</Text>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  row:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15 },
  label: { fontSize: 15, fontWeight: '700' },
  sub:   { fontSize: 13, marginTop: 2 },

  indicatorWrap: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  radioRing: { position: 'absolute', width: 20, height: 20, borderRadius: 10, borderWidth: 2 },

  errorCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 18, padding: 14,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
  },
  errorTitle: { fontSize: 14, fontWeight: '700' },
  errorBody:  { fontSize: 12, marginTop: 2, lineHeight: 17 },
  retryBtn:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, minWidth: 64, alignItems: 'center' },
  retryText:  { color: '#fff', fontSize: 13, fontWeight: '700' },

  note: { fontSize: 12, textAlign: 'center', marginTop: 22, paddingHorizontal: 30, lineHeight: 18 },
});
