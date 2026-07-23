// truevision/components/ui/ActionSheet.js
//
// Modern, theme-aware bottom action sheet — the app-wide replacement for the
// stock Android AlertDialog / iOS ActionSheetIOS look. Rounded top, dim
// backdrop, smooth slide-up / slide-down, safe-area aware.
//
// Reusable anywhere:
//   <ActionSheet
//     visible={open}
//     onClose={() => setOpen(false)}
//     title="Options"                       // optional
//     options={[
//       { key:'mute',  icon:'notifications-off-outline', label:'Mute', onPress: ... },
//       { key:'block', icon:'ban-outline', label:'Block', destructive:true, onPress: ... },
//       { key:'soon',  icon:'images-outline', label:'Shared Media', soon:true },  // TODO placeholder
//     ]}
//   />
//
// Options:
//   { key, icon, label, sublabel?, onPress?, destructive?, disabled?, soon?, right? }
//   - `soon`     → dimmed + "Soon" pill, not pressable (a real TODO, not a fake button)
//   - `disabled` → dimmed, not pressable
//   - `destructive` → danger colour

import { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function ActionSheet({ visible, onClose, title, options = [] }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Keep the sheet mounted through the exit animation.
  const [mounted, setMounted] = useState(visible);
  const slide   = useRef(new Animated.Value(0)).current; // 0 hidden → 1 shown
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slide,   { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop,{ toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slide,   { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop,{ toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });

  const press = (opt) => {
    if (opt.disabled || opt.soon || !opt.onPress) return;
    onClose?.();
    // Let the close animation begin before the action runs (feels native).
    setTimeout(() => opt.onPress(), 120);
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={S.root}>
        <Animated.View style={[S.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            S.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: (insets.bottom || 12) + 8,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[S.handle, { backgroundColor: colors.divider }]} />

          {title ? <Text style={[S.title, { color: colors.textMuted }]}>{title}</Text> : null}

          <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
            {options.map((opt, i) => {
              const dim  = opt.disabled || opt.soon;
              const tint = opt.destructive ? colors.danger : colors.text;
              return (
                <TouchableOpacity
                  key={opt.key || i}
                  activeOpacity={dim ? 1 : 0.6}
                  onPress={() => press(opt)}
                  style={[S.row, { opacity: dim ? 0.5 : 1 }]}
                >
                  <View style={[
                    S.iconChip,
                    { backgroundColor: opt.destructive ? colors.iconChipDanger : colors.iconChipBg },
                  ]}>
                    <Ionicons name={opt.icon || 'ellipse-outline'} size={19}
                      color={opt.destructive ? colors.danger : colors.text} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[S.label, { color: tint }]}>{opt.label}</Text>
                    {opt.sublabel ? (
                      <Text style={[S.sublabel, { color: colors.textDim }]} numberOfLines={1}>{opt.sublabel}</Text>
                    ) : null}
                  </View>

                  {opt.soon ? (
                    <View style={[S.soonPill, { backgroundColor: colors.iconChipBg }]}>
                      <Text style={[S.soonTxt, { color: colors.textDim }]}>Soon</Text>
                    </View>
                  ) : opt.right ?? (opt.onPress && !dim ? (
                    <Ionicons name="chevron-forward" size={17} color={colors.textDim} />
                  ) : null)}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  root:     { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 8, paddingHorizontal: 10,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 20,
  },
  handle:  { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 8 },
  title:   { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginLeft: 14, marginVertical: 8 },
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 8 },
  iconChip:{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  label:   { fontSize: 15, fontWeight: '600' },
  sublabel:{ fontSize: 12, marginTop: 2 },
  soonPill:{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  soonTxt: { fontSize: 10.5, fontWeight: '700' },
});
