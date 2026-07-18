// truevision/screens/AudienceSettingScreen.js
//
// Radio-style audience picker shared by two privacy settings:
//   navigate('AudienceSetting', { kind: 'whoCanMessage' })  → "Who Can Message Me"
//   navigate('AudienceSetting', { kind: 'whoCanComment' })  → "Who Can Comment"
//
// Reads/writes prefs.privacy[kind] via usePreferences().setPath — writes are
// optimistic (the hook reverts on failure) and we surface an Alert when the
// server rejects the change.

import { Alert, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import { Section, SettingsRow } from '../components/settings/SettingsRow';
import usePreferences from '../hooks/usePreferences';
import { useTheme } from '../context/ThemeContext';

const buildOptions = (kind) => [
  {
    value: 'everyone',
    label: 'Everyone',
    sub: 'Anyone on TrueVision',
    icon: 'globe-outline',
  },
  {
    value: 'followers',
    label: 'Followers',
    sub: 'Only people who follow you',
    icon: 'people-outline',
  },
  {
    value: 'mutual',
    label: 'Mutual Followers',
    sub: 'Only people you follow back',
    icon: 'swap-horizontal-outline',
  },
  {
    value: 'nobody',
    label: 'Nobody',
    sub: kind === 'whoCanMessage'
      ? 'No one can message you'
      : 'Comments are turned off on your videos',
    icon: 'ban-outline',
  },
];

export default function AudienceSettingScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { prefs, setPath } = usePreferences();

  const kind  = route?.params?.kind === 'whoCanComment' ? 'whoCanComment' : 'whoCanMessage';
  const title = kind === 'whoCanMessage' ? 'Who Can Message Me' : 'Who Can Comment';

  const current = prefs?.privacy?.[kind] || 'everyone';
  const options = buildOptions(kind);

  const choose = async (value) => {
    if (value === current) return;
    const res = await setPath(`privacy.${kind}`, value);
    if (res?.success === false) {
      Alert.alert('Could not save', res?.message || 'Please check your connection and try again.');
    }
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section
          title="Audience"
          footer={
            kind === 'whoCanMessage'
              ? 'Controls who can message you. Applies immediately, including to existing conversations.'
              : 'Controls who can comment on your videos. You can always delete comments on your own videos.'
          }
        >
          {options.map((o, i) => (
            <SettingsRow
              key={o.value}
              icon={o.icon}
              label={o.label}
              sub={o.sub}
              onPress={() => choose(o.value)}
              showChevron={false}
              last={i === options.length - 1}
              right={
                <Ionicons
                  name={current === o.value ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={current === o.value ? colors.accent : colors.textDim}
                />
              }
            />
          ))}
        </Section>

        <Text style={[S.note, { color: colors.textDim }]}>
          Changes save automatically and apply immediately across TrueVision.
        </Text>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 22, paddingHorizontal: 24 },
});
