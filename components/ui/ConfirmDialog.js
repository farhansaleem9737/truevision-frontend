// truevision/components/ui/ConfirmDialog.js
//
// A premium, theme-aware confirmation card — the in-app replacement for the
// stock Alert.alert() dialog, so confirmations match the TrueVision design
// language (rounded card, soft icon chip, blur + dim backdrop, scale/fade in).
//
//   <ConfirmDialog
//     visible={bool}
//     icon="log-out-outline"
//     title="Log out?"
//     message="You’ll need to sign in again to access your account."
//     confirmLabel="Log out"
//     cancelLabel="Cancel"
//     destructive
//     loading={bool}                 // spinner on the confirm button
//     onConfirm={fn}
//     onCancel={fn}
//   />

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Modal, Animated, Easing, StyleSheet, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function ConfirmDialog({
  visible,
  icon = 'alert-circle-outline',
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const { colors, isDark } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(anim, { toValue: 0, duration: 150, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  const scale  = anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const accent = destructive ? colors.danger : colors.accent;
  const chipBg = destructive
    ? (colors.iconChipDanger || 'rgba(239,68,68,0.15)')
    : (colors.iconChipBg || 'rgba(59,130,246,0.15)');

  return (
    <Modal transparent visible animationType="none" onRequestClose={loading ? undefined : onCancel} statusBarTranslucent>
      {/* Blur + dim backdrop — tap to cancel */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
        <BlurView intensity={isDark ? 18 : 32} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
          onPress={loading ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
      </Animated.View>

      <View style={S.center} pointerEvents="box-none">
        <Animated.View style={[S.card, { backgroundColor: colors.card, opacity: anim, transform: [{ scale }] }]}>
          <View style={[S.iconWrap, { backgroundColor: chipBg }]}>
            <Ionicons name={icon} size={26} color={accent} />
          </View>

          {title ? <Text style={[S.title, { color: colors.text }]}>{title}</Text> : null}
          {message ? <Text style={[S.msg, { color: colors.textMuted }]}>{message}</Text> : null}

          <View style={S.btnRow}>
            <Pressable
              style={({ pressed }) => [S.btn, S.btnGhost, { borderColor: colors.divider, opacity: pressed ? 0.6 : 1 }]}
              onPress={onCancel}
              disabled={loading}
              android_ripple={{ color: colors.divider }}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text style={[S.btnTxt, { color: colors.text }]}>{cancelLabel}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [S.btn, { backgroundColor: accent, opacity: pressed ? 0.85 : 1 }]}
              onPress={onConfirm}
              disabled={loading}
              android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[S.btnTxt, { color: '#fff' }]}>{confirmLabel}</Text>}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  card: {
    width: '100%', maxWidth: 380, borderRadius: 22, padding: 22, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 24,
  },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 19, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  msg:   { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 22 },
  btnRow:{ flexDirection: 'row', width: '100%', gap: 10 },
  btn:   { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnGhost: { borderWidth: 1.5, backgroundColor: 'transparent' },
  btnTxt: { fontSize: 15.5, fontWeight: '700' },
});
