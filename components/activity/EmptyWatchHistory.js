// truevision/components/activity/EmptyWatchHistory.js
//
// Empty state for the Watch History screen — illustration tile, title,
// subtitle, and an "Explore Videos" call-to-action that navigates back to
// the Home feed.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function EmptyWatchHistory({ onExplore }) {
  const { colors } = useTheme();

  return (
    <View style={S.wrap}>
      {/* Illustration */}
      <View style={[S.iconBox, { backgroundColor: colors.iconChipBg, borderColor: colors.divider }]}>
        <Ionicons name="time-outline" size={44} color={colors.textMuted} />
      </View>

      <Text style={[S.title, { color: colors.text }]}>No watch history yet</Text>
      <Text style={[S.sub,   { color: colors.textMuted }]}>
        Videos you watch will appear here.
      </Text>

      <Pressable
        onPress={onExplore}
        style={[S.cta, { backgroundColor: colors.accent }]}
        android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
      >
        <Ionicons name="compass-outline" size={16} color="#fff" />
        <Text style={S.ctaText}>Explore Videos</Text>
      </Pressable>
    </View>
  );
}

const S = StyleSheet.create({
  wrap: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingVertical: 60,
  },
  iconBox: {
    width: 96, height: 96, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 18,
  },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  sub:   { fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginBottom: 22 },

  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 999,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
