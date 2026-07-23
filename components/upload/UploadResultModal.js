// truevision/components/upload/UploadResultModal.js
//
// Premium result modal shown after an upload — replaces the stock Alert.
// Handles four outcomes via `result.kind`:
//   'approved' → Upload Complete   (View Video / Close)
//   'blocked'  → Video Blocked     (Request Review / Cancel)  — entertainment
//   'pending'  → Under Review      (Got it)
//   'failed'   → Upload Failed     (Try Again / Close)
//
// Dark-theme aware, rounded, soft shadow, fade + scale in, animated icon.

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Modal, Animated, Easing, StyleSheet, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const C = (isDark) => isDark ? {
  card: '#171923', text: '#FFFFFF', sub: '#A5A8B8', muted: '#72778C',
  border: 'rgba(255,255,255,0.08)', box: 'rgba(255,255,255,0.04)',
} : {
  card: '#FFFFFF', text: '#0E1122', sub: '#5B6070', muted: '#9498A8',
  border: 'rgba(15,23,42,0.08)', box: 'rgba(15,23,42,0.03)',
};

const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');

const CONFIG = {
  approved: { grad: ['#22C55E', '#16A34A'], icon: 'checkmark', title: 'Upload Complete', msg: 'Your video has been uploaded successfully.' },
  blocked:  { grad: ['#EF4444', '#DC2626'], icon: 'close',     title: 'Video Blocked',    msg: 'Entertainment content is not allowed on TrueVision.' },
  pending:  { grad: ['#F59E0B', '#D97706'], icon: 'time',      title: 'Under Review',     msg: 'Your video is being reviewed and will publish if it fits TrueVision.' },
  failed:   { grad: ['#EF4444', '#B91C1C'], icon: 'cloud-offline', title: 'Upload Failed', msg: 'Something went wrong. Please try again.' },
};

const ModRow = ({ c, label, value, valueColor }) => (
  <View style={S.modRow}>
    <Text style={[S.modLabel, { color: c.muted }]}>{label}</Text>
    <Text style={[S.modValue, { color: valueColor || c.text }]} numberOfLines={1}>{value}</Text>
  </View>
);

export default function UploadResultModal({ visible, result, busy = false, onClose, onViewVideo, onRequestReview, onRetry }) {
  const { isDark } = useTheme();
  const c = C(isDark);
  const anim     = useRef(new Animated.Value(0)).current;
  const iconAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      iconAnim.setValue(0);
      Animated.spring(iconAnim, { toValue: 1, useNativeDriver: true, friction: 5, tension: 120, delay: 120 }).start();
    } else if (mounted) {
      Animated.timing(anim, { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !result) return null;

  const kind = result.kind || 'pending';
  const cfg  = CONFIG[kind] || CONFIG.pending;
  const mod  = result.moderation || {};
  // REAL model output — never hardcoded. categoryConfidence is the BART
  // zero-shot top-label probability (0–1); confidence is the NSFW model's
  // worst-frame score (0–1). Shown to one decimal so distinct videos read as
  // distinct values (e.g. 97.2% vs 94.6%). Absent → "—", never a faked 100%.
  const pct        = (v) => (typeof v === 'number' && isFinite(v)) ? `${(v * 100).toFixed(1)}%` : '—';
  const aiCatConf  = pct(mod.categoryConfidence);
  const nsfwConf   = pct(mod.confidence);
  const catColor   = kind === 'blocked' ? '#EF4444' : kind === 'pending' ? '#F59E0B' : '#22C55E';

  const scale     = anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const iconScale = iconAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={busy ? undefined : onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
        <BlurView intensity={isDark ? 20 : 36} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          onPress={kind === 'approved' && !busy ? onClose : undefined}
        />
      </Animated.View>

      <View style={S.center} pointerEvents="box-none">
        <Animated.View style={[S.card, { backgroundColor: c.card, borderColor: c.border, opacity: anim, transform: [{ scale }] }]}>
          <Animated.View style={{ transform: [{ scale: iconScale }], marginBottom: 16 }}>
            <LinearGradient colors={cfg.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.iconWrap}>
              <Ionicons name={cfg.icon} size={40} color="#fff" />
            </LinearGradient>
          </Animated.View>

          <Text style={[S.title, { color: c.text }]}>{cfg.title}</Text>
          <Text style={[S.msg, { color: c.sub }]}>{result.message || cfg.msg}</Text>

          {/* Moderation detail box (not shown on plain failures). Always shows
              the REAL AI category + BART confidence + safety verdict — the same
              stored values the admin/review screens display. */}
          {kind !== 'failed' && (
            <View style={[S.modBox, { borderColor: c.border, backgroundColor: c.box }]}>
              {mod.category ? (
                <ModRow c={c} label="AI Category" value={cap(mod.category)} valueColor={catColor} />
              ) : null}
              <ModRow c={c} label="AI Confidence" value={aiCatConf} />
              <ModRow
                c={c}
                label="Safety Check"
                value={mod.status ? `${mod.status}${typeof mod.confidence === 'number' && mod.confidence > 0 ? ` · ${nsfwConf}` : ''}` : 'SAFE'}
                valueColor="#22C55E"
              />
            </View>
          )}

          {/* Buttons */}
          <View style={S.btns}>
            {kind === 'approved' ? (
              <>
                <Pressable style={[S.btn, S.ghost, { borderColor: c.border }]} onPress={onClose} disabled={busy}>
                  <Text style={[S.btnTxt, { color: c.text }]}>Close</Text>
                </Pressable>
                <SolidBtn label="View Video" onPress={onViewVideo} disabled={busy} />
              </>
            ) : kind === 'blocked' ? (
              <>
                <Pressable style={[S.btn, S.ghost, { borderColor: c.border }]} onPress={onClose} disabled={busy}>
                  <Text style={[S.btnTxt, { color: c.text }]}>Cancel</Text>
                </Pressable>
                <SolidBtn label="Request Review" onPress={onRequestReview} busy={busy} />
              </>
            ) : kind === 'failed' ? (
              <>
                <Pressable style={[S.btn, S.ghost, { borderColor: c.border }]} onPress={onClose} disabled={busy}>
                  <Text style={[S.btnTxt, { color: c.text }]}>Close</Text>
                </Pressable>
                <SolidBtn label="Try Again" onPress={onRetry} disabled={busy} />
              </>
            ) : (
              <SolidBtn label="Got it" onPress={onClose} disabled={busy} full />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const SolidBtn = ({ label, onPress, disabled, busy, full }) => (
  <Pressable onPress={onPress} disabled={disabled || busy} style={[full ? { width: '100%' } : { flex: 1 }]}>
    <LinearGradient
      colors={['#6C5CFF', '#4D63FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[S.btn, S.solid, (disabled || busy) && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[S.btnTxt, { color: '#fff' }]}>{label}</Text>}
    </LinearGradient>
  </Pressable>
);

const S = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  card: {
    width: '100%', maxWidth: 380, borderRadius: 26, padding: 24, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 26,
  },
  iconWrap: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  msg:   { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  modBox: { width: '100%', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20 },
  modRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  modLabel: { fontSize: 13 },
  modValue: { fontSize: 13.5, fontWeight: '800', marginLeft: 12, flexShrink: 1, textAlign: 'right' },
  btns: { flexDirection: 'row', width: '100%', gap: 10 },
  btn:  { height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  ghost:{ flex: 1, borderWidth: 1.5, backgroundColor: 'transparent' },
  solid:{ /* width from parent */ },
  btnTxt: { fontSize: 15, fontWeight: '800' },
});
