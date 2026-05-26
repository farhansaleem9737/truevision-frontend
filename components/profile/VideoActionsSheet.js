// truevision/components/profile/VideoActionsSheet.js
//
// Modern Instagram/TikTok-style bottom sheet shown on long-press of a video tile.
// Two actions only: Pin/Unpin and Delete. No title, no Cancel button.
//
// Design notes
// • Frosted (BlurView) sheet on top of a fading dark backdrop.
// • Spring slide-up + fade animations, mirrored on dismiss.
// • Theme-aware (dark + light) using ThemeContext tokens.
// • Tap backdrop to dismiss; subtle drag-handle hint at the top.
// • Delete asks for an inline confirmation rendered inside the same sheet —
//   keeps us off the native Alert.alert dialog the redesign explicitly avoids.

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, TouchableWithoutFeedback,
  Modal, Animated, Dimensions, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';

const { height: SCREEN_H } = Dimensions.get('window');

export default function VideoActionsSheet({
  visible,
  isPinned = false,
  onClose,
  onPin,
  onDelete,
}) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const slideY  = useRef(new Animated.Value(SCREEN_H)).current;
  const fade    = useRef(new Animated.Value(0)).current;

  // We render the modal whenever `visible` is true OR while the dismiss
  // animation is still playing, so the slide-down is visible to the user.
  const [mounted, setMounted]       = useState(visible);
  const [confirmDelete, setConfirm] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setConfirm(false);
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

  const handlePin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose?.();
    // Defer to next tick so the close animation can start before the parent
    // potentially re-renders (e.g. after togglePin updates the grid).
    setTimeout(() => onPin?.(), 60);
  };

  const handleDeletePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setConfirm(true);
  };

  const handleConfirmDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    onClose?.();
    setTimeout(() => onDelete?.(), 60);
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
          {
            paddingBottom: Math.max(insets.bottom, 12) + 8,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 60 : 90}
          tint={isDark ? 'dark' : 'light'}
          style={[S.sheet, { backgroundColor: palette.sheetBg, borderColor: palette.border }]}
        >
          <View style={[S.handle, { backgroundColor: palette.handle }]} />

          {!confirmDelete ? (
            <View style={S.list}>
              <ActionRow
                icon={isPinned ? 'pin' : 'pin-outline'}
                label={isPinned ? 'Unpin from profile' : 'Pin to Profile'}
                onPress={handlePin}
                palette={palette}
              />
              <View style={[S.divider, { backgroundColor: palette.divider }]} />
              <ActionRow
                icon="trash-outline"
                label="Delete Video"
                onPress={handleDeletePress}
                palette={palette}
                danger
              />
            </View>
          ) : (
            <View style={S.confirmWrap}>
              <View style={[S.confirmIcon, { backgroundColor: palette.dangerSoft }]}>
                <Ionicons name="trash" size={22} color={palette.danger} />
              </View>
              <Text style={[S.confirmTitle, { color: palette.text }]}>
                Delete this video?
              </Text>
              <Text style={[S.confirmBody, { color: palette.textMuted }]}>
                This will permanently remove the video. This cannot be undone.
              </Text>
              <View style={S.confirmActions}>
                <Pressable
                  onPress={() => setConfirm(false)}
                  style={({ pressed }) => [
                    S.confirmBtn,
                    {
                      backgroundColor: palette.btnNeutralBg,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <Text style={[S.confirmBtnLabel, { color: palette.text }]}>Keep</Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirmDelete}
                  style={({ pressed }) => [
                    S.confirmBtn,
                    {
                      backgroundColor: palette.danger,
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <Text style={[S.confirmBtnLabel, { color: '#fff' }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
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
  sheetBg:       'rgba(20,20,24,0.78)',
  border:        'rgba(255,255,255,0.06)',
  divider:       'rgba(255,255,255,0.06)',
  handle:        'rgba(255,255,255,0.25)',
  text:          '#f5f5f7',
  textMuted:     '#a1a1aa',
  iconChipBg:    'rgba(255,255,255,0.08)',
  ripple:        'rgba(255,255,255,0.08)',
  danger:        '#ff5a5f',
  dangerSoft:    'rgba(255,90,95,0.15)',
  btnNeutralBg:  'rgba(255,255,255,0.10)',
};

const LIGHT = {
  sheetBg:       'rgba(255,255,255,0.86)',
  border:        'rgba(15,23,42,0.06)',
  divider:       'rgba(15,23,42,0.06)',
  handle:        'rgba(15,23,42,0.18)',
  text:          '#0f172a',
  textMuted:     '#64748b',
  iconChipBg:    '#f1f5f9',
  ripple:        'rgba(15,23,42,0.06)',
  danger:        '#ef4444',
  dangerSoft:    '#fef2f2',
  btnNeutralBg:  '#f1f5f9',
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
    marginBottom: 10,
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

  // Inline delete confirmation
  confirmWrap: {
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4, marginBottom: 12,
  },
  confirmTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  confirmBody:  { fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  confirmActions: {
    flexDirection: 'row', alignSelf: 'stretch',
    gap: 10,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnLabel: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
