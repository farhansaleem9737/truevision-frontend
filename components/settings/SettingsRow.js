// truevision/components/settings/SettingsRow.js
//
// Reusable row + section primitives used across every settings sub-screen.
// Theme-aware: dark mode swaps card / text / divider / icon-chip colours.

import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export const Section = ({ title, children, footer }) => {
  const { colors } = useTheme();
  return (
    <View style={S.section}>
      {title ? (
        <Text style={[S.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      ) : null}
      <View style={[S.sectionBody, { backgroundColor: colors.card }]}>{children}</View>
      {footer ? (
        <Text style={[S.sectionFooter, { color: colors.textDim }]}>{footer}</Text>
      ) : null}
    </View>
  );
};

export const SettingsRow = ({
  icon,
  label,
  sub,
  onPress,
  right,
  danger,
  last,
  showChevron = true,
}) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      style={[
        S.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
      ]}
    >
      {icon ? (
        <View style={[
          S.iconWrap,
          { backgroundColor: danger ? colors.iconChipDanger : colors.iconChipBg },
        ]}>
          <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.text} />
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <Text style={[S.label, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
        {sub ? <Text style={[S.sub, { color: colors.textMuted }]}>{sub}</Text> : null}
      </View>

      {right ?? (onPress && showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
      ) : null)}
    </TouchableOpacity>
  );
};

export const SwitchRow = ({ icon, label, sub, value, onValueChange, last }) => {
  const { colors } = useTheme();
  return (
    <SettingsRow
      icon={icon}
      label={label}
      sub={sub}
      showChevron={false}
      last={last}
      right={
        <Switch
          value={!!value}
          onValueChange={onValueChange}
          trackColor={{ true: colors.accent, false: colors.divider }}
          thumbColor="#fff"
          ios_backgroundColor={colors.divider}
        />
      }
    />
  );
};

const S = StyleSheet.create({
  section: { paddingTop: 22, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 12, fontWeight: '800',
    letterSpacing: 0.6, textTransform: 'uppercase',
    marginBottom: 10, marginLeft: 4,
  },
  sectionBody: {
    borderRadius: 14, overflow: 'hidden',
  },
  sectionFooter: {
    fontSize: 12, marginTop: 8, marginLeft: 6,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14,
  },

  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },

  label: { fontSize: 14.5, fontWeight: '600' },
  sub:   { fontSize: 12, marginTop: 2 },
});

export default SettingsRow;
