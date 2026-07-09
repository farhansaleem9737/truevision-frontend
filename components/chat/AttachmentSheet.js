// truevision/components/chat/AttachmentSheet.js
//
// Bottom-sheet attachment picker. Replaces the old Alert-based dialog with a
// modern 3-column grid inspired by WhatsApp / Messenger:
//
//   [📷 Camera]   [🖼 Gallery]  [🎥 Video]
//   [📁 Document] [🎵 Audio]    [📍 Location]
//   [👤 Contact]  [🎙 Voice]    [📊 Poll]
//
// Contract:
//   <AttachmentSheet
//     visible={bool}
//     onClose={fn}
//     onAction={(kind) => …}      // kind ∈ 'camera' | 'gallery' | 'video' |
//                                 // 'document' | 'audio' | 'location' |
//                                 // 'contact' | 'voice' | 'poll'
//     dark?={bool}                // theme flip (defaults to dark)
//   />
//
// Purely presentational — the parent decides what each action does. This
// keeps the sheet reusable across chats/groups/stories.

import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Easing, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_H } = Dimensions.get('window');

// ── Grid data ──────────────────────────────────────────────────────────────
// Each tile gets its own accent colour so the sheet reads as a coloured
// mini-launcher (WhatsApp uses the same pattern). Icons are picked from the
// pack that renders cleanest at 22px.
const ITEMS = [
  { kind: 'camera',   label: 'Camera',   icon: 'camera',            lib: 'ion',  bg: ['#F472B6', '#EC4899'] },
  { kind: 'gallery',  label: 'Gallery',  icon: 'image',             lib: 'ion',  bg: ['#8B5CF6', '#7C3AED'] },
  { kind: 'video',    label: 'Video',    icon: 'videocam',          lib: 'ion',  bg: ['#EF4444', '#DC2626'] },
  { kind: 'document', label: 'Document', icon: 'document-text',     lib: 'ion',  bg: ['#3B82F6', '#2563EB'] },
  { kind: 'audio',    label: 'Audio',    icon: 'musical-notes',     lib: 'ion',  bg: ['#F59E0B', '#D97706'] },
  { kind: 'location', label: 'Location', icon: 'location',          lib: 'ion',  bg: ['#10B981', '#059669'] },
  { kind: 'contact',  label: 'Contact',  icon: 'person',            lib: 'ion',  bg: ['#06B6D4', '#0891B2'] },
  { kind: 'voice',    label: 'Voice',    icon: 'mic',               lib: 'ion',  bg: ['#F97316', '#EA580C'] },
  { kind: 'poll',     label: 'Poll',     icon: 'poll',              lib: 'mci',  bg: ['#A855F7', '#9333EA'] },
];

// ── Palette ────────────────────────────────────────────────────────────────
const palette = (dark) => dark ? {
  backdrop:  'rgba(0,0,0,0.55)',
  sheet:     '#111B22',
  border:    'rgba(255,255,255,0.06)',
  handle:    'rgba(255,255,255,0.18)',
  title:     '#E9EDEF',
  subtitle:  '#8696A0',
  label:     '#E9EDEF',
  cancelBg:  'rgba(255,255,255,0.06)',
  cancelTx:  '#E9EDEF',
  glassTint: 'dark',
} : {
  backdrop:  'rgba(0,0,0,0.35)',
  sheet:     '#FFFFFF',
  border:    'rgba(15,23,42,0.08)',
  handle:    'rgba(15,23,42,0.18)',
  title:     '#0F172A',
  subtitle:  '#64748B',
  label:     '#0F172A',
  cancelBg:  'rgba(15,23,42,0.06)',
  cancelTx:  '#0F172A',
  glassTint: 'light',
};

// ── Icon dispatch ──────────────────────────────────────────────────────────
const Icon = ({ lib, name, size = 24, color }) =>
  lib === 'mci'
    ? <MaterialCommunityIcons name={name} size={size} color={color} />
    : <Ionicons name={name} size={size} color={color} />;

// ─── Component ────────────────────────────────────────────────────────────
export default function AttachmentSheet({ visible, onClose, onAction, dark = true }) {
  const ct       = palette(dark);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Spring in on open, ease-out on close. Cleans up naturally when Modal
  // unmounts.
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 180,
      easing: visible ? Easing.out(Easing.back(1.2)) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_H * 0.6, 0],
  });
  const backdropOp = slideAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, 1],
  });

  const handlePress = (kind) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
    onClose?.();
    // Small delay so the sheet animation doesn't fight the next screen's
    // opening animation (camera / picker modals).
    setTimeout(() => onAction?.(kind), 220);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Tap outside to close */}
      <TouchableOpacity activeOpacity={1} style={SH.overlay} onPress={onClose}>
        <Animated.View style={[SH.backdrop, { backgroundColor: ct.backdrop, opacity: backdropOp }]} />

        {/* Sheet body — swallowed touches don't propagate to backdrop */}
        <Animated.View
          onStartShouldSetResponder={() => true}
          style={[
            SH.sheet,
            { backgroundColor: ct.sheet, borderColor: ct.border, transform: [{ translateY }] },
          ]}
        >
          <BlurView intensity={dark ? 30 : 50} tint={ct.glassTint} style={StyleSheet.absoluteFill} />

          {/* Drag handle */}
          <View style={SH.handleWrap}>
            <View style={[SH.handle, { backgroundColor: ct.handle }]} />
          </View>

          {/* Title */}
          <Text style={[SH.title, { color: ct.title }]}>Share</Text>
          <Text style={[SH.subtitle, { color: ct.subtitle }]}>Choose what to send</Text>

          {/* 3-column grid */}
          <View style={SH.grid}>
            {ITEMS.map((it) => (
              <TouchableOpacity
                key={it.kind}
                activeOpacity={0.85}
                style={SH.tile}
                onPress={() => handlePress(it.kind)}
              >
                <LinearGradient
                  colors={it.bg}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={SH.tileIcon}
                >
                  <Icon lib={it.lib} name={it.icon} color="#FFFFFF" size={22} />
                </LinearGradient>
                <Text style={[SH.tileLabel, { color: ct.label }]}>{it.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cancel */}
          <TouchableOpacity
            style={[SH.cancel, { backgroundColor: ct.cancelBg }]}
            activeOpacity={0.85}
            onPress={onClose}
          >
            <Text style={[SH.cancelTxt, { color: ct.cancelTx }]}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const SH = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'flex-end' },
  backdrop:  { ...StyleSheet.absoluteFillObject },

  sheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8, paddingBottom: 34,
    overflow: 'hidden',
  },

  handleWrap:{ alignItems: 'center', paddingVertical: 6 },
  handle:    { width: 42, height: 4, borderRadius: 2 },

  title:     { fontSize: 20, fontWeight: '700', paddingHorizontal: 22, marginTop: 6 },
  subtitle:  { fontSize: 13, paddingHorizontal: 22, marginTop: 3 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, paddingTop: 18, paddingBottom: 8,
  },
  tile: {
    width: '33.3333%',
    alignItems: 'center', paddingVertical: 10, marginBottom: 6,
  },
  tileIcon: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  tileLabel: {
    fontSize: 12, fontWeight: '600', marginTop: 8,
  },

  cancel: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  },
  cancelTxt: { fontSize: 15, fontWeight: '700' },
});
