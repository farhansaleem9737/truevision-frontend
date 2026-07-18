// truevision/screens/ActivityScreen.js
//
// Hub for the user's activity history. Each row routes to a dedicated
// sub-screen. The "Clear all history" action wipes every history section at
// once via /api/activity/all (does NOT touch comments/likes/saves — those are
// state on the video itself, not history).

import { Alert, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow } from '../components/settings/SettingsRow';
import { useTheme } from '../context/ThemeContext';
import activityService from '../services/ActivityService';

export default function ActivityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const clearAll = () => {
    Alert.alert(
      t('activity.clearAllTitle'),
      t('activity.clearAllBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('activity.clearAll'),
          style: 'destructive',
          onPress: async () => {
            const res = await activityService.clearAll();
            if (res?.success) {
              Alert.alert(t('activity.clearedTitle'), t('activity.cleared'));
            } else {
              Alert.alert(t('activity.clearFailed'), res?.message || t('common.tryAgainLater'));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title={t('activity.title')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section title={t('activity.sectionBrowsing')}>
          <SettingsRow
            icon="eye-outline"
            label={t('activity.recentlyViewed')}
            sub={t('activity.recentlyViewedSub')}
            onPress={() => navigation.navigate('ViewedProfiles')}
            last
          />
        </Section>

        <Section title={t('activity.sectionYou')}>
          <SettingsRow
            icon="heart-outline"
            label={t('activity.likedVideos')}
            onPress={() => navigation.navigate('LikedVideos')}
          />
          <SettingsRow
            icon="bookmark-outline"
            label={t('activity.savedVideos')}
            onPress={() => navigation.navigate('SavedVideos')}
          />
          <SettingsRow
            icon="paper-plane-outline"
            label={t('activity.sharedVideos')}
            onPress={() => navigation.navigate('SharedVideos')}
          />
          <SettingsRow
            icon="chatbubble-ellipses-outline"
            label={t('activity.commentsHistory')}
            sub={t('activity.commentsSub')}
            onPress={() => navigation.navigate('CommentsHistory')}
            last
          />
        </Section>

        <Section title={t('activity.sectionSearch')}>
          <SettingsRow
            icon="search-outline"
            label={t('activity.searchHistory')}
            onPress={() => navigation.navigate('SearchHistory')}
            last
          />
        </Section>

        <Section title={t('activity.manage')}>
          <SettingsRow
            icon="trash-outline"
            label={t('activity.clearAll')}
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
