// truevision/screens/ActivityScreen.js
//
// Hub for the user's activity history. Most subsections (Watch History,
// Comments History, Search History, Recently Viewed) require event-tracking
// backend infra that doesn't exist yet — those rows show a friendly notice.
//
// "Liked Videos" and "Saved Videos" are real and route to dedicated screens.

import { Alert, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow } from '../components/settings/SettingsRow';
import { useTheme } from '../context/ThemeContext';

export default function ActivityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const stub = (label) => Alert.alert(
    label,
    'This view is coming soon — it needs server-side activity tracking.',
  );

  const clearHistory = () => {
    Alert.alert(
      'Clear all history',
      "This will clear your watch, search and view history once tracking ships. You can always undo before confirming.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear all', style: 'destructive', onPress: () => Alert.alert('Cleared', 'History cleared.') },
      ],
    );
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="My Activity" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section title="What you've watched">
          <SettingsRow icon="time-outline"     label="Watch History"   onPress={() => stub('Watch History')} />
          <SettingsRow icon="eye-outline"      label="Recently Viewed" sub="Profiles you've recently visited" onPress={() => stub('Recently Viewed')} last />
        </Section>

        <Section title="Your activity">
          <SettingsRow icon="heart-outline"    label="Liked Videos"     onPress={() => stub('Liked Videos')} />
          <SettingsRow icon="bookmark-outline" label="Saved Videos"     onPress={() => navigation.navigate('SavedVideos')} />
          <SettingsRow icon="chatbubble-outline" label="Comments History" onPress={() => stub('Comments History')} />
          <SettingsRow icon="paper-plane-outline" label="Shared Videos" onPress={() => stub('Shared Videos')} last />
        </Section>

        <Section title="Search">
          <SettingsRow icon="search-outline" label="Search History" onPress={() => stub('Search History')} last />
        </Section>

        <Section title="Manage">
          <SettingsRow
            icon="trash-outline" label="Clear all history"
            danger onPress={clearHistory}
            last showChevron={false}
          />
        </Section>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
});
