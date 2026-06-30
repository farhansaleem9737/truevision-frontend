// truevision/components/activity/SelectionToolbar.js
//
// Sticky bottom toolbar shown while the user is in multi-select mode on the
// Watch History screen. Displays the selected count and two actions:
// Cancel and Delete Selected. Disabled state when no items are selected.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function SelectionToolbar({
  selectedCount = 0,
  onCancel,
  onDeleteSelected,
}) {
  const insets   = useSafeAreaInsets();
  const { colors } = useTheme();
  const canDelete = selectedCount > 0;

  return (
    <View
      style={[
        S.bar,
        {
          paddingBottom: Math.max(insets.bottom, 12),
          backgroundColor: colors.card,
          borderTopColor: colors.divider,
        },
      ]}
    >
      <Pressable onPress={onCancel} style={S.cancelBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Text style={[S.cancelText, { color: colors.textMuted }]}>Cancel</Text>
      </Pressable>

      <Text style={[S.count, { color: colors.text }]}>
        {selectedCount === 0 ? 'Select items' : `${selectedCount} selected`}
      </Text>

      <Pressable
        onPress={canDelete ? onDeleteSelected : undefined}
        style={[
          S.deleteBtn,
          { backgroundColor: canDelete ? colors.danger : colors.surface, opacity: canDelete ? 1 : 0.7 },
        ]}
      >
        <Ionicons name="trash-outline" size={16} color={canDelete ? '#fff' : colors.textDim} />
        <Text
          style={[
            S.deleteText,
            { color: canDelete ? '#fff' : colors.textDim },
          ]}
        >
          Delete
        </Text>
      </Pressable>
    </View>
  );
}

const S = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  cancelText: { fontSize: 15, fontWeight: '600' },
  count: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12,
  },
  deleteText: { fontSize: 14, fontWeight: '800' },
});
