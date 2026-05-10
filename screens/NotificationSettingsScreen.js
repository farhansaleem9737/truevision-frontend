// truevision/screens/NotificationSettingsScreen.js
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SwitchRow } from '../components/settings/SettingsRow';
import usePreferences from '../hooks/usePreferences';
import { useTheme } from '../context/ThemeContext';

export default function NotificationSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { prefs, setPath } = usePreferences();
  const n = prefs.notifications;

  const set = (key) => (v) => setPath(`notifications.${key}`, v);

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section title="Push Notifications">
          <SwitchRow icon="heart-outline"             label="Likes"         value={n.likes}        onValueChange={set('likes')} />
          <SwitchRow icon="chatbubble-outline"        label="Comments"      value={n.comments}     onValueChange={set('comments')} />
          <SwitchRow icon="person-add-outline"        label="New Followers" value={n.newFollowers} onValueChange={set('newFollowers')} />
          <SwitchRow icon="paper-plane-outline"       label="Messages"      value={n.messages}     onValueChange={set('messages')} />
          <SwitchRow icon="at-outline"                label="Mentions"      value={n.mentions}     onValueChange={set('mentions')} />
          <SwitchRow icon="rocket-outline"            label="App Updates"   value={n.appUpdates}   onValueChange={set('appUpdates')} last />
        </Section>

        <Section title="Email Notifications">
          <SwitchRow
            icon="shield-checkmark-outline" label="Security Alerts"
            sub="Login attempts and account changes"
            value={n.emailSecurity} onValueChange={set('emailSecurity')}
          />
          <SwitchRow icon="mail-outline"        label="Newsletter"  value={n.emailNewsletter} onValueChange={set('emailNewsletter')} />
          <SwitchRow icon="pricetag-outline"    label="Promotions"  value={n.emailPromotions} onValueChange={set('emailPromotions')} />
          <SwitchRow icon="stats-chart-outline" label="Weekly Reports" value={n.emailWeekly}   onValueChange={set('emailWeekly')} last />
        </Section>

        <Text style={S.note}>
          Your preferences sync automatically. Push delivery requires a device token registration which is set up at sign-in.
        </Text>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  note: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 22, paddingHorizontal: 30, lineHeight: 18 },
});
