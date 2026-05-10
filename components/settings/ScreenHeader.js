// truevision/components/settings/ScreenHeader.js
//
// Shared back-button header used by every settings sub-screen. Reads the
// active theme so the header bar/text/divider follow dark-mode automatically.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function ScreenHeader({ title, onBack, right = null }) {
  const { colors } = useTheme();
  return (
    <View style={[
      S.header,
      { backgroundColor: colors.bg, borderBottomColor: colors.divider },
    ]}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </TouchableOpacity>
      <Text style={[S.title, { color: colors.text }]}>{title}</Text>
      <View style={S.right}>{right}</View>
    </View>
  );
}

const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '800' },
  right: { width: 26, alignItems: 'flex-end' },
});
