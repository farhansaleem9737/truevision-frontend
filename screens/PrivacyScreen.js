// truevision/screens/PrivacyScreen.js
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow, SwitchRow } from '../components/settings/SettingsRow';
import usePreferences from '../hooks/usePreferences';
import { useTheme } from '../context/ThemeContext';

export default function PrivacyScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { prefs, setPath } = usePreferences();
  const p = prefs.privacy;

  // Audience enum → localized label. Unknown values fall back to the raw key.
  const audienceLabel = (key) =>
    t(`privacy.audience.${key}`, { defaultValue: key });

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title={t('privacy.title')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section title={t('privacy.account')} footer={t('privacy.accountFooter')}>
          <SwitchRow
            icon="lock-closed-outline" label={t('privacy.privateAccount')}
            value={p.privateAccount}
            onValueChange={(v) => setPath('privacy.privateAccount', v)}
          />
          <SwitchRow
            icon="eye-off-outline" label={t('privacy.hideOnline')}
            sub={t('privacy.hideOnlineSub')}
            value={p.hideOnlineStatus}
            onValueChange={(v) => setPath('privacy.hideOnlineStatus', v)}
          />
          <SwitchRow
            icon="people-outline" label={t('privacy.hideFollowers')}
            value={p.hideFollowers}
            onValueChange={(v) => setPath('privacy.hideFollowers', v)}
            last
          />
        </Section>

        <Section title={t('privacy.interactions')}>
          <SettingsRow
            icon="chatbox-outline" label={t('privacy.whoCanMessage')}
            sub={audienceLabel(p.whoCanMessage)}
            onPress={() => navigation.navigate('AudienceSetting', { kind: 'whoCanMessage' })}
          />
          <SettingsRow
            icon="chatbubble-ellipses-outline" label={t('privacy.whoCanComment')}
            sub={audienceLabel(p.whoCanComment)}
            onPress={() => navigation.navigate('AudienceSetting', { kind: 'whoCanComment' })}
            last
          />
        </Section>

        <Section title={t('privacy.blocked')}>
          <SettingsRow
            icon="ban-outline" label={t('privacy.blockedUsers')}
            sub={t('privacy.blockedUsersSub')}
            onPress={() => navigation.navigate('BlockedUsers')}
            last
          />
        </Section>

        <Text style={[S.note, { color: colors.textDim }]}>
          {t('privacy.note')}
        </Text>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 22 },
});
