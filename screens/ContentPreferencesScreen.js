// truevision/screens/ContentPreferencesScreen.js
import { Alert, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow, SwitchRow } from '../components/settings/SettingsRow';
import usePreferences from '../hooks/usePreferences';
import { useTheme } from '../context/ThemeContext';

const TOPIC_POOL = [
  'Travel', 'Food', 'Music', 'Sports', 'Tech', 'Comedy',
  'Fashion', 'Fitness', 'Nature', 'Gaming', 'Education', 'Lifestyle',
];

export default function ContentPreferencesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { prefs, setPath } = usePreferences();
  const c = prefs.content;
  const set = (key) => (v) => setPath(`content.${key}`, v);

  const toggleTopic = (topic) => {
    const has  = c.interestedTopics.includes(topic);
    const next = has
      ? c.interestedTopics.filter((t) => t !== topic)
      : [...c.interestedTopics, topic];
    setPath('content.interestedTopics', next);
  };

  const editTopics = () => {
    Alert.alert(
      'Interested Topics',
      'Pick your topics:',
      TOPIC_POOL.map((t) => ({
        text: `${c.interestedTopics.includes(t) ? '✓ ' : ''}${t}`,
        onPress: () => toggleTopic(t),
      })).concat([{ text: 'Done', style: 'cancel' }]),
    );
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Content Preferences" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section title="Topics">
          <SettingsRow
            icon="sparkles-outline" label="Interested Topics"
            sub={c.interestedTopics.length
              ? c.interestedTopics.join(', ')
              : 'Pick what you want more of'}
            onPress={editTopics}
            last
          />
        </Section>

        <Section title="Playback">
          <SwitchRow
            icon="play-circle-outline" label="Auto-play Videos"
            value={c.autoplay} onValueChange={set('autoplay')}
          />
          <SwitchRow
            icon="wifi-outline" label="HD Playback on Wi-Fi only"
            sub="Stream lower quality on cellular"
            value={c.hdOnWifi} onValueChange={set('hdOnWifi')}
          />
          <SwitchRow
            icon="cellular-outline" label="Data Saver"
            sub="Reduce video bitrate everywhere"
            value={c.dataSaver} onValueChange={set('dataSaver')}
            last
          />
        </Section>

        <Section title="Recommendations">
          <SwitchRow
            icon="shield-half-outline" label="Hide Sensitive Content"
            value={c.hideSensitive} onValueChange={set('hideSensitive')}
          />
          <SwitchRow
            icon="trending-up-outline" label="Personalized Recommendations"
            sub="Use your activity to tailor your feed"
            value={c.personalizedRecs} onValueChange={set('personalizedRecs')}
            last
          />
        </Section>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
});
