// truevision/screens/PrivacyScreen.js
import { Alert, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow, SwitchRow } from '../components/settings/SettingsRow';
import usePreferences from '../hooks/usePreferences';
import { useTheme } from '../context/ThemeContext';

const audienceLabel = (key) => ({
  everyone: 'Everyone',
  followers: 'Followers',
  nobody:   'Nobody',
}[key] || key);

const cycleAudience = (current) => {
  const order = ['everyone', 'followers', 'nobody'];
  return order[(order.indexOf(current) + 1) % order.length];
};

export default function PrivacyScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { prefs, setPath } = usePreferences();
  const p = prefs.privacy;

  const cycle = (key) => setPath(`privacy.${key}`, cycleAudience(p[key]));

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Privacy" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section title="Account" footer="When private, only approved followers can see your videos.">
          <SwitchRow
            icon="lock-closed-outline" label="Private Account"
            value={p.privateAccount}
            onValueChange={(v) => setPath('privacy.privateAccount', v)}
          />
          <SwitchRow
            icon="eye-off-outline" label="Hide Online Status"
            sub="Others can't see when you're active"
            value={p.hideOnlineStatus}
            onValueChange={(v) => setPath('privacy.hideOnlineStatus', v)}
          />
          <SwitchRow
            icon="people-outline" label="Hide Followers List"
            value={p.hideFollowers}
            onValueChange={(v) => setPath('privacy.hideFollowers', v)}
            last
          />
        </Section>

        <Section title="Interactions">
          <SettingsRow
            icon="chatbox-outline" label="Who can message me"
            sub={audienceLabel(p.whoCanMessage)}
            onPress={() => cycle('whoCanMessage')}
          />
          <SettingsRow
            icon="chatbubble-ellipses-outline" label="Who can comment"
            sub={audienceLabel(p.whoCanComment)}
            onPress={() => cycle('whoCanComment')}
            last
          />
        </Section>

        <Section title="Blocked">
          <SettingsRow
            icon="ban-outline" label="Blocked Users"
            sub="Manage people you've blocked"
            onPress={() => Alert.alert('Blocked Users', 'No blocked users yet. Block management is coming soon.')}
            last
          />
        </Section>

        <Text style={S.note}>
          Your changes save automatically.
        </Text>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  note: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 22 },
});
