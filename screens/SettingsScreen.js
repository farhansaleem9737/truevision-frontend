// truevision/screens/SettingsScreen.js
//
// Top-level settings hub. Each row routes to a dedicated sub-screen.
// Visual primitives come from components/settings/SettingsRow.js so every
// settings page looks identical and follows the active theme.

import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow, SwitchRow } from '../components/settings/SettingsRow';
import { useTheme } from '../context/ThemeContext';

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isDark, colors, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const go = (route) => navigation.navigate(route);

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title={t('settings.title')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section title={t('settings.account')}>
          <SettingsRow icon="pulse-outline"             label={t('settings.myActivity')}  onPress={() => go('Activity')} />
          <SettingsRow icon="create-outline"            label={t('settings.editProfile')} onPress={() => go('EditProfile')} />
          <SettingsRow icon="lock-closed-outline"       label={t('settings.privacy')}     onPress={() => go('Privacy')} />
          <SettingsRow icon="shield-checkmark-outline"  label={t('settings.security')}    onPress={() => go('Security')} last />
        </Section>

        <Section title={t('settings.display')}>
          <SwitchRow
            icon={isDark ? 'moon' : 'moon-outline'}
            label={t('settings.darkMode')}
            sub={isDark ? t('settings.darkOn') : t('settings.darkOff')}
            value={isDark}
            onValueChange={toggleTheme}
            last
          />
        </Section>

        <Section title={t('settings.content')}>
          <SettingsRow icon="bookmark-outline"          label={t('settings.savedVideos')}     onPress={() => go('SavedVideos')} />
          <SettingsRow icon="cloud-download-outline"    label={t('settings.downloadHistory')} onPress={() => go('DownloadHistory')} last />
        </Section>

        <Section title={t('settings.notifications')}>
          <SettingsRow icon="notifications-outline"     label={t('settings.notifications')} sub={t('settings.notificationsSub')} onPress={() => go('NotificationSettings')} last />
        </Section>

        <Section title={t('settings.general')}>
          <SettingsRow icon="globe-outline"             label={t('settings.language')}           onPress={() => go('Language')} />
          <SettingsRow icon="options-outline"           label={t('settings.contentPreferences')} onPress={() => go('ContentPreferences')} last />
        </Section>

        <Section title={t('settings.support')}>
          <SettingsRow icon="help-circle-outline"        label={t('settings.help')}  onPress={() => go('HelpSupport')} />
          <SettingsRow icon="information-circle-outline" label={t('settings.about')} onPress={() => go('About')} last />
        </Section>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },  // backgroundColor injected from theme at runtime
});
