// truevision/screens/ActivityScreen.js
//
// Hub for the user's activity history. Each row routes to a dedicated
// sub-screen under screens/activity/. The "Clear all history" action wipes
// every section at once via /api/activity/all (does NOT touch likes/saves —
// those are state on the video itself, not history).

import { Alert, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow } from '../components/settings/SettingsRow';
import { useTheme } from '../context/ThemeContext';
import activityService from '../services/ActivityService';

export default function ActivityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const clearAll = () => {
    Alert.alert(
      'Clear all history',
      "This deletes your watch history, recently-viewed profiles, share history and search history. Liked + saved videos are NOT affected. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            const res = await activityService.clearAll();
            if (res?.success) {
              Alert.alert('Cleared', 'All activity history has been removed.');
            } else {
              Alert.alert('Could not clear', res?.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="My Activity" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section title="What you've watched">
          <SettingsRow
            icon="time-outline"
            label="Watch History"
            onPress={() => navigation.navigate('WatchHistory')}
          />
          <SettingsRow
            icon="eye-outline"
            label="Recently Viewed"
            sub="Profiles you've recently visited"
            onPress={() => navigation.navigate('ViewedProfiles')}
            last
          />
        </Section>

        <Section title="Your activity">
          <SettingsRow
            icon="heart-outline"
            label="Liked Videos"
            onPress={() => navigation.navigate('LikedVideos')}
          />
          <SettingsRow
            icon="bookmark-outline"
            label="Saved Videos"
            onPress={() => navigation.navigate('SavedVideos')}
          />
          <SettingsRow
            icon="paper-plane-outline"
            label="Shared Videos"
            onPress={() => navigation.navigate('SharedVideos')}
            last
          />
        </Section>

        <Section title="Search">
          <SettingsRow
            icon="search-outline"
            label="Search History"
            onPress={() => navigation.navigate('SearchHistory')}
            last
          />
        </Section>

        <Section title="Manage">
          <SettingsRow
            icon="trash-outline"
            label="Clear all history"
            danger
            onPress={clearAll}
            last
            showChevron={false}
          />
        </Section>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
});
