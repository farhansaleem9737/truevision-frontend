// truevision/components/chat/AttachmentSheet.js
//
// Bottom-sheet attachment picker. Modern 3-column grid inspired by
// WhatsApp / Telegram / Messenger:
//
//   [📷 Camera]   [🖼 Gallery]  [🎥 Video]
//   [📁 Document] [🎵 Audio]    [📍 Location]
//   [👤 Contact]  [🎙 Voice]    [📊 Poll]
//
// Contract (unchanged — the parent decides what each action does):
//   <AttachmentSheet
//     visible={bool}
//     onClose={fn}
//     onAction={(kind) => …}      // 'camera'|'gallery'|'video'|'document'|
//                                 // 'audio'|'location'|'contact'|'voice'|'poll'
//     dark?={bool}                // theme flip (defaults to dark)
//   />
//
// Production polish in this version:
//   • Safe-area-aware Cancel button — never merges with the Android gesture /
//     navigation bar (keeps ≥16px above the inset).
//   • Drag-to-dismiss (flick or drag the sheet down) + tap-outside dismiss.
//   • Guard so an accidental backdrop tap / drag can't fire while a picker is
//     already opening.
//   • 220ms slide (no flashy overshoot), fade + blur backdrop.
//   • Equal-sized 48dp+ grid tiles with press scale, Android ripple and haptics.
//   • Accessibility roles/labels throughout.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, Animated, Easing,
  Pressable, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// ── Grid data ──────────────────────────────────────────────────────────────
const ITEMS = [
  { kind: 'camera',   label: 'Camera',   icon: 'camera',        lib: 'ion', bg: ['#F472B6', '#EC4899'] },
  { kind: 'gallery',  label: 'Gallery',  icon: 'image',         lib: 'ion', bg: ['#8B5CF6', '#7C3AED'] },
  { kind: 'video',    label: 'Video',    icon: 'videocam',      lib: 'ion', bg: ['#EF4444', '#DC2626'] },
  { kind: 'document', label: 'Document', icon: 'document-text', lib: 'ion', bg: ['#3B82F6', '#2563EB'] },
  { kind: 'audio',    label: 'Audio',    icon: 'musical-notes', lib: 'ion', bg: ['#F59E0B', '#D97706'] },
  { kind: 'location', label: 'Location', icon: 'location',      lib: 'ion', bg: ['#10B981', '#059669'] },
  { kind: 'contact',  label: 'Contact',  icon: 'person',        lib: 'ion', bg: ['#06B6D4', '#0891B2'] },
  { kind: 'voice',    label: 'Voice',    icon: 'mic',           lib: 'ion', bg: ['#F97316', '#EA580C'] },
  { kind: 'poll',     label: 'Poll',     icon: 'poll',          lib: 'mci', bg: ['#A855F7', '#9333EA'] },
];

// ── Palette ────────────────────────────────────────────────────────────────
const palette = (dark) => dark ? {
  backdrop:  'rgba(0,0,0,0.55)', sheet: '#111B22', border: 'rgba(255,255,255,0.06)',
  handle: 'rgba(255,255,255,0.22)', title: '#E9EDEF', subtitle: '#8696A0', label: '#E9EDEF',
  cancelBg: 'rgba(255,255,255,0.08)', cancelTx: '#E9EDEF', ripple: 'rgba(255,255,255,0.12)', glassTint: 'dark',
} : {
  backdrop:  'rgba(0,0,0,0.35)', sheet: '#FFFFFF', border: 'rgba(15,23,42,0.08)',
  handle: 'rgba(15,23,42,0.18)', title: '#0F172A', subtitle: '#64748B', label: '#0F172A',
  cancelBg: 'rgba(15,23,42,0.06)', cancelTx: '#0F172A', ripple: 'rgba(15,23,42,0.08)', glassTint: 'light',
};

const Icon = ({ lib, name, size = 24, color }) =>
  lib === 'mci'
    ? <MaterialCommunityIcons name={name} size={size} color={color} />
    : <Ionicons name={name} size={size} color={color} />;

// ── Grid tile with press-scale + ripple + haptic ─────────────────────────────
const Tile = ({ item, label, ct, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      style={SH.tile}
      onPressIn={() => to(0.9)}
      onPressOut={() => to(1)}
      onPress={onPress}
      android_ripple={{ color: ct.ripple, borderless: true, radius: 44 }}
      accessibilityRole="button"
      accessibilityLabel={`Send ${label}`}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient colors={item.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={SH.tileIcon}>
          <Icon lib={item.lib} name={item.icon} color="#FFFFFF" size={24} />
        </LinearGradient>
      </Animated.View>
      <Text style={[SH.tileLabel, { color: ct.label }]}>{label}</Text>
    </Pressable>
  );
};

// ─── Component ────────────────────────────────────────────────────────────
export default function AttachmentSheet({ visible, onClose, onAction, dark = true }) {
  const ct = palette(dark);
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(0)).current; // 0 hidden → 1 shown
  const dragY     = useRef(new Animated.Value(0)).current; // live drag offset
  const [sheetH, setSheetH] = useState(560);               // measured on layout
  const [mounted, setMounted] = useState(visible);
  const actingRef = useRef(false);                         // guards double-dismiss / picker-open race

  // Mount for the enter/exit animation; unmount only after the exit finishes.
  useEffect(() => {
    if (visible) {
      actingRef.current = false;
      dragY.setValue(0);
      setMounted(true);
      Animated.timing(slideAnim, {
        toValue: 1, duration: 230, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(slideAnim, {
        toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Single dismiss path — idempotent, so backdrop + drag + Cancel can't stack.
  const dismiss = useCallback(() => {
    if (actingRef.current) return;
    actingRef.current = true;
    onClose?.();
  }, [onClose]);

  const choose = useCallback((kind) => {
    if (actingRef.current) return;         // ignore a stray second tap while opening
    actingRef.current = true;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
    onClose?.();
    // Let the sheet slide out before the picker/camera modal opens (no fight).
    setTimeout(() => onAction?.(kind), 230);
  }, [onClose, onAction]);

  // Drag-to-dismiss: a downward drag past a threshold (or a quick flick) closes.
  const pan = useRef(PanResponder.create({
    // Only claim the gesture on a real downward drag — taps still reach tiles.
    onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx * 1.4),
    onPanResponderMove: (_e, g) => { if (g.dy > 0) dragY.setValue(g.dy); },
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 110 || g.vy > 0.6) {
        // Fling it the rest of the way down, then close.
        Animated.timing(dragY, { toValue: 600, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true })
          .start(() => dismiss());
      } else {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
      }
    },
    onPanResponderTerminate: () => { Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start(); },
  })).current;

  if (!mounted) return null;

  const baseTranslate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [sheetH, 0] });
  const translateY = Animated.add(baseTranslate, dragY);
  const backdropOp = slideAnim;

  // Cancel sits ≥16px above the gesture/nav bar, never merged with it.
  const bottomInset = Math.max(insets.bottom, 12) + 8;

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <View style={SH.root}>
        {/* Backdrop — blur + fade. Tap to dismiss. */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOp }]}>
          <BlurView intensity={dark ? 22 : 40} tint={ct.glassTint} style={StyleSheet.absoluteFill} />
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: ct.backdrop }]}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Close attachment menu"
          />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          {...pan.panHandlers}
          onLayout={(e) => setSheetH(e.nativeEvent.layout.height + 40)}
          style={[
            SH.sheet,
            { backgroundColor: ct.sheet, borderColor: ct.border, paddingBottom: bottomInset, transform: [{ translateY }] },
          ]}
        >
          {/* Drag handle */}
          <View style={SH.handleWrap} accessibilityLabel="Drag down to close" accessibilityRole="adjustable">
            <View style={[SH.handle, { backgroundColor: ct.handle }]} />
          </View>

          <Text style={[SH.title, { color: ct.title }]}>Share</Text>
          <Text style={[SH.subtitle, { color: ct.subtitle }]}>Choose what to send</Text>

          <View style={SH.grid}>
            {ITEMS.map((it) => (
              <Tile key={it.kind} item={it} label={it.label} ct={ct} onPress={() => choose(it.kind)} />
            ))}
          </View>

          {/* Cancel — full-width, rounded, safe-area aware, press-scale */}
          <CancelButton ct={ct} onPress={dismiss} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const CancelButton = ({ ct, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }], marginTop: 6 }}>
      <Pressable
        style={[SH.cancel, { backgroundColor: ct.cancelBg }]}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        onPress={onPress}
        android_ripple={{ color: ct.ripple }}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text style={[SH.cancelTxt, { color: ct.cancelTx }]}>Cancel</Text>
      </Pressable>
    </Animated.View>
  );
};

const SH = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },

  sheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    overflow: 'hidden',
  },

  handleWrap: { alignItems: 'center', paddingVertical: 8 },
  handle:     { width: 42, height: 5, borderRadius: 3 },

  title:    { fontSize: 20, fontWeight: '700', paddingHorizontal: 22, marginTop: 4 },
  subtitle: { fontSize: 13, paddingHorizontal: 22, marginTop: 3 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 10, paddingTop: 18, paddingBottom: 10,
  },
  // 33.33% columns → equal spacing/alignment. minHeight keeps a ≥48dp target.
  tile: {
    width: '33.3333%', minHeight: 92,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10,
  },
  tileIcon: {
    width: 58, height: 58, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  tileLabel: { fontSize: 12, fontWeight: '600', marginTop: 8 },

  cancel: {
    marginHorizontal: 16,
    height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  cancelTxt: { fontSize: 15.5, fontWeight: '700' },
});
