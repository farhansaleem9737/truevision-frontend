// truevision/components/profile/MoreOptionsSheet.js
//
// Bottom sheet shown when the three-dot button is tapped on the Profile header.
// Three actions: Settings, Help & Support, Logout.
//
// Design notes
// • Frosted (BlurView) sheet over a fading dark backdrop — matches the look of
//   VideoActionsSheet for visual consistency.
// • Theme-aware (light + dark) via ThemeContext.
// • Bottom inset is read from `useSafeAreaInsets()` so the sheet floats clearly
//   above the Android nav bar and the iPhone home indicator. Without this the
//   Logout row was clipping into the system UI on Android.
// • Tap backdrop to dismiss; spring slide-up + fade animations, mirrored on
//   close so the user sees the sheet leave instead of disappearing instantly.

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, TouchableOpacity, TouchableWithoutFeedback,
  Modal, Animated, Dimensions, Alert, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';

const { height: SCREEN_H } = Dimensions.get('window');

export default function MoreOptionsSheet({ visible, onClose, onSettings, onHelp, onLogout }) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const fade   = useRef(new Animated.Value(0)).current;

  // Keep the modal mounted while the close animation runs so the slide-down
  // is actually visible to the user.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Haptics.selectionAsync().catch(() => {});
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 22, tension: 220,
        }),
        Animated.timing(fade, {
          toValue: 1, duration: 180, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: SCREEN_H, duration: 220, useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 0, duration: 180, useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, slideY, fade]);

  if (!mounted) return null;

  const palette = isDark ? DARK : LIGHT;

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onClose?.();
    // Defer the confirmation so the sheet's close animation can play first.
    setTimeout(() => {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive', onPress: () => onLogout?.() },
        ],
        { cancelable: true },
      );
    }, 220);
  };

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Fading backdrop — tap to dismiss */}
      <Animated.View style={[S.backdrop, { opacity: fade }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          S.sheetWrap,
          { transform: [{ translateY: slideY }] },
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 60 : 90}
          tint={isDark ? 'dark' : 'light'}
          style={[
            S.sheet,
            {
              backgroundColor: palette.sheetBg,
              borderColor: palette.border,
              // Floor of 12 px so the sheet still has breathing room on
              // devices that report insets.bottom === 0 (most Android phones
              // with on-screen 3-button nav).
              paddingBottom: Math.max(insets.bottom, 12) + 8,
            },
          ]}
        >
          <View style={[S.handle, { backgroundColor: palette.handle }]} />

          <View style={S.headerRow}>
            <Text style={[S.title, { color: palette.text }]}>More Options</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[S.closeBtn, { backgroundColor: palette.iconChipBg }]}
            >
              <Ionicons name="close" size={18} color={palette.text} />
            </TouchableOpacity>
          </View>

          <View style={S.list}>
            <ActionRow
              icon="settings-outline"
              label="Settings"
              onPress={() => { onClose?.(); onSettings?.(); }}
              palette={palette}
            />
            <View style={[S.divider, { backgroundColor: palette.divider }]} />
            <ActionRow
              icon="help-circle-outline"
              label="Help & Support"
              onPress={() => { onClose?.(); onHelp?.(); }}
              palette={palette}
            />
            <View style={[S.divider, { backgroundColor: palette.divider }]} />
            <ActionRow
              icon="log-out-outline"
              label="Logout"
              onPress={handleLogout}
              palette={palette}
              danger
            />
          </View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

const ActionRow = ({ icon, label, onPress, danger, palette }) => (
  <Pressable
    onPress={onPress}
    android_ripple={{ color: palette.ripple, borderless: false }}
    style={({ pressed }) => [
      S.row,
      Platform.OS === 'ios' && {
        opacity: pressed ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      },
    ]}
  >
    <View
      style={[
        S.iconWrap,
        { backgroundColor: danger ? palette.dangerSoft : palette.iconChipBg },
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={danger ? palette.danger : palette.text}
      />
    </View>
    <Text
      style={[
        S.label,
        { color: danger ? palette.danger : palette.text },
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

// ── Palettes ─────────────────────────────────────────────────────────────────
const DARK = {
  sheetBg:    'rgba(20,20,24,0.78)',
  border:     'rgba(255,255,255,0.06)',
  divider:    'rgba(255,255,255,0.06)',
  handle:     'rgba(255,255,255,0.25)',
  text:       '#f5f5f7',
  iconChipBg: 'rgba(255,255,255,0.08)',
  ripple:     'rgba(255,255,255,0.08)',
  danger:     '#ff5a5f',
  dangerSoft: 'rgba(255,90,95,0.15)',
};

const LIGHT = {
  sheetBg:    'rgba(255,255,255,0.86)',
  border:     'rgba(15,23,42,0.06)',
  divider:    'rgba(15,23,42,0.06)',
  handle:     'rgba(15,23,42,0.18)',
  text:       '#0f172a',
  iconChipBg: '#f1f5f9',
  ripple:     'rgba(15,23,42,0.06)',
  danger:     '#ef4444',
  dangerSoft: '#fef2f2',
};

const S = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 10,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.30,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    marginTop: 4,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8,
  },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },

  list: { paddingTop: 4, paddingBottom: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 12,
    borderRadius: 14,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  label: { fontSize: 15.5, fontWeight: '600', letterSpacing: 0.1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
});
