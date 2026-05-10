// truevision/screens/SettingsScreen.js
//
// Top-level settings hub. Each row routes to a dedicated sub-screen.
// Visual primitives come from components/settings/SettingsRow.js so every
// settings page looks identical and follows the active theme.

import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow, SwitchRow } from '../components/settings/SettingsRow';
import { useTheme } from '../context/ThemeContext';

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isDark, colors, toggleTheme } = useTheme();
  const go = (route) => navigation.navigate(route);

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section title="Account">
          <SettingsRow icon="pulse-outline"             label="My Activity"   onPress={() => go('Activity')} />
          <SettingsRow icon="create-outline"            label="Edit Profile"  onPress={() => go('EditProfile')} />
          <SettingsRow icon="lock-closed-outline"       label="Privacy"       onPress={() => go('Privacy')} />
          <SettingsRow icon="shield-checkmark-outline"  label="Security"      onPress={() => go('Security')} last />
        </Section>

        <Section title="Display">
          <SwitchRow
            icon={isDark ? 'moon' : 'moon-outline'}
            label="Dark Mode"
            sub={isDark ? 'Dark theme is on' : 'Switch to a darker look'}
            value={isDark}
            onValueChange={toggleTheme}
            last
          />
        </Section>

        <Section title="Content">
          <SettingsRow icon="bookmark-outline"          label="Saved Videos"      onPress={() => go('SavedVideos')} />
          <SettingsRow icon="cloud-download-outline"    label="Download History"  onPress={() => go('DownloadHistory')} last />
        </Section>

        <Section title="Notifications">
          <SettingsRow icon="notifications-outline"     label="Notifications"     sub="Push and email" onPress={() => go('NotificationSettings')} last />
        </Section>

        <Section title="General">
          <SettingsRow icon="globe-outline"             label="Language"              onPress={() => go('Language')} />
          <SettingsRow icon="options-outline"           label="Content Preferences"   onPress={() => go('ContentPreferences')} last />
        </Section>

        <Section title="Support">
          <SettingsRow icon="help-circle-outline"        label="Help & Support"     onPress={() => go('HelpSupport')} />
          <SettingsRow icon="information-circle-outline" label="About TrueVision"   onPress={() => go('About')} last />
        </Section>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },  // backgroundColor injected from theme at runtime
});
