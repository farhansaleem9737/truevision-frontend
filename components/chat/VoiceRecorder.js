// truevision/components/chat/VoiceRecorder.js
//
// WhatsApp-style hold-to-record with slide-to-cancel + slide-up-to-lock.
//
// Consumer contract:
//   <VoiceRecorder
//     ct={themeTokens}                      // colour palette from parent
//     onSend={({ uri, durationMs }) => …}   // fires when the user releases,
//                                           // slides down on locked mode, or
//                                           // taps the send button in lock mode.
//     onCancel={() => …}                    // slide-cancel or too-short-to-send
//     idleContent={<MicButton />}           // the base pill that shows when
//                                           // NOT recording (usually the mic
//                                           // circle from the composer)
//   />
//
// The base composer stays untouched — this component overlays a recording
// row whenever `recording === true` internally. It NEVER uploads directly;
// the parent decides what to do with the resulting URI. That keeps the
// existing upload flow (chatService.uploadChatVoice) unchanged.
//
// Gesture model — one PanResponder handles the whole lifecycle:
//   • grant                 → start recording, capture start time
//   • move.x < -LEFT_THRESHOLD  and !locked → cancel (release cancels too)
//   • move.y < -UP_THRESHOLD    and !locked → LOCK: recording continues, gesture ends
//   • release (not locked)  → send if ≥ 1 s, else cancel
//   • send tapped (locked)  → send
//   • cancel tapped (locked)→ cancel
//   • pause / resume        → pause/resume the recorder in place
//
// The visual pieces move via a native-driven Animated.Value tied to the pan
// x-offset — the mic slides horizontally, the "slide to cancel" hint fades,
// and the trash icon grows as the user drags left.

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
  Platform, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
// TODO (Expo SDK 55+): migrate `expo-av` Audio.Recording → `expo-audio`
// (useAudioRecorder). Deprecated but functional on SDK 53/54 — keep until the
// SDK upgrade to avoid a mid-development regression.
import { Audio } from 'expo-av';

// Gesture thresholds — tuned to feel WhatsApp-ish at 60 fps.
const LEFT_THRESHOLD = -85;   // slide-to-cancel
const UP_THRESHOLD   = -80;   // slide-to-lock

const fmtDuration = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
};

export default function VoiceRecorder({ ct, onSend, onCancel, onRecordingChange, idleContent }) {
  const [recording, setRecording] = useState(false);   // any active recording
  const [locked,    setLocked]    = useState(false);   // hands-free continue
  const [paused,    setPaused]    = useState(false);   // pause/resume state
  const [durationMs, setDurationMs] = useState(0);
  const [waveform,  setWaveform]  = useState([]);      // last N amplitude samples

  // Native-driven animation values.
  const panX          = useRef(new Animated.Value(0)).current; // horizontal drag
  const panY          = useRef(new Animated.Value(0)).current; // vertical drag
  const cancelHintOp  = useRef(new Animated.Value(1)).current; // "slide to cancel" fade
  const trashScale    = useRef(new Animated.Value(1)).current; // trash icon grow near cancel
  const lockGlow      = useRef(new Animated.Value(0)).current; // lock affordance pulse
  const micPulse      = useRef(new Animated.Value(1)).current; // idle-mic breathing

  // Refs to the underlying recorder + timer so gesture handlers stay stable.
  const recordingRef = useRef(null);
  const startedAt    = useRef(0);
  const pausedAt     = useRef(0);        // ms spent paused
  const pauseSpanStart = useRef(0);
  const durationTimer = useRef(null);
  const lockedRef    = useRef(false);
  const isRecordingRef = useRef(false);

  // Notify parent whenever recording flips so it can swap out the input
  // area and let the recorder overlay span the whole composer.
  useEffect(() => {
    onRecordingChange?.(recording);
  }, [recording, onRecordingChange]);

  // Idle mic gentle breathing — subtle affordance that the button is live.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, { toValue: 1.06, duration: 1400, useNativeDriver: true }),
        Animated.timing(micPulse, { toValue: 1,    duration: 1400, useNativeDriver: true }),
      ]),
    );
    if (!recording) loop.start();
    return () => loop.stop();
  }, [recording, micPulse]);

  // ── Timer + waveform sampling ──────────────────────────────────────────
  const tickDuration = () => {
    if (!isRecordingRef.current || paused) return;
    setDurationMs(Date.now() - startedAt.current - pausedAt.current);
  };

  const onStatusUpdate = (status) => {
    if (!status.isRecording) return;
    // metering is -160..0 dB; map to 4..26 px bars for the waveform strip.
    const meter = status.metering ?? -30;
    const norm  = Math.max(0, Math.min(1, (meter + 60) / 60));
    const bar   = 4 + Math.round(norm * 22);
    setWaveform(prev => {
      const next = prev.length > 40 ? prev.slice(1) : prev.slice();
      next.push(bar);
      return next;
    });
  };

  // ── Start / stop lifecycle ─────────────────────────────────────────────
  const beginRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return false;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      rec.setProgressUpdateInterval(120);
      rec.setOnRecordingStatusUpdate(onStatusUpdate);
      await rec.startAsync();

      recordingRef.current = rec;
      startedAt.current  = Date.now();
      pausedAt.current   = 0;
      isRecordingRef.current = true;

      setRecording(true); setLocked(false); setPaused(false);
      setDurationMs(0); setWaveform([]);
      lockedRef.current = false;

      // Kick off duration ticker (setInterval — the RN Animated frame loop
      // is not appropriate for a plain text field update).
      durationTimer.current = setInterval(tickDuration, 200);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return true;
    } catch (e) {
      console.warn('[voice] begin', e.message);
      return false;
    }
  };

  const stopRecording = async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    isRecordingRef.current = false;

    clearInterval(durationTimer.current); durationTimer.current = null;
    if (!rec) return null;
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      const dur = Date.now() - startedAt.current - pausedAt.current;
      return { uri, durationMs: dur };
    } catch (e) {
      console.warn('[voice] stop', e.message);
      return null;
    }
  };

  const resetVisuals = () => {
    panX.setValue(0); panY.setValue(0);
    cancelHintOp.setValue(1);
    trashScale.setValue(1);
    lockGlow.setValue(0);
  };

  const finish = async (send) => {
    setRecording(false); setLocked(false); setPaused(false);
    lockedRef.current = false;
    resetVisuals();

    const result = await stopRecording();
    if (!result?.uri) return;

    // Guard against accidental sub-1s recordings (finger tap).
    if (send && result.durationMs < 1000) {
      onCancel?.();
      return;
    }
    if (send) onSend?.(result);
    else      onCancel?.();
  };

  // ── Pause / Resume (locked mode only) ──────────────────────────────────
  const pause = async () => {
    if (!recordingRef.current || paused) return;
    try {
      await recordingRef.current.pauseAsync();
      pauseSpanStart.current = Date.now();
      setPaused(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (e) { console.warn('pause', e.message); }
  };

  const resume = async () => {
    if (!recordingRef.current || !paused) return;
    try {
      await recordingRef.current.startAsync();
      pausedAt.current += (Date.now() - pauseSpanStart.current);
      setPaused(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (e) { console.warn('resume', e.message); }
  };

  // ── PanResponder — the whole hold/slide gesture ────────────────────────
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: async () => {
      const ok = await beginRecording();
      if (!ok) {
        // Snap back — parent will see nothing happened.
        onCancel?.();
      }
    },
    onPanResponderMove: (_, gs) => {
      if (lockedRef.current || !isRecordingRef.current) return;

      // Only allow drag in the two intended directions (left, up).
      const dx = Math.min(0, gs.dx);
      const dy = Math.min(0, gs.dy);
      panX.setValue(dx);
      panY.setValue(dy);

      // Fade "slide to cancel" hint as user drags left.
      const fade = Math.max(0, 1 + dx / (LEFT_THRESHOLD * 1.2));
      cancelHintOp.setValue(fade);
      // Grow the trash icon near the cancel threshold.
      const grow = 1 + Math.min(0.6, (-dx) / 200);
      trashScale.setValue(grow);
      // Fade in lock affordance as user drags up.
      const lockA = Math.min(1, (-dy) / Math.abs(UP_THRESHOLD));
      lockGlow.setValue(lockA);

      // Cross the up-threshold → lock and end gesture (recording continues).
      if (dy < UP_THRESHOLD) {
        lockedRef.current = true;
        setLocked(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        Animated.parallel([
          Animated.spring(panX, { toValue: 0, useNativeDriver: true, friction: 6 }),
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, friction: 6 }),
          Animated.timing(cancelHintOp, { toValue: 0, duration: 120, useNativeDriver: true }),
          Animated.timing(lockGlow,     { toValue: 0, duration: 120, useNativeDriver: true }),
        ]).start();
        return;
      }

      // Cross the left-threshold → cancel (also fires on release beyond it).
      if (dx < LEFT_THRESHOLD - 40) {
        // Ignore — release handler will cancel; keeping the visual pulled
        // out gives a stronger "you're about to cancel" cue.
      }
    },
    onPanResponderRelease: (_, gs) => {
      if (lockedRef.current) return; // hands-free, controls in the row
      // Snap the pill back with a spring for a satisfying release feel.
      Animated.parallel([
        Animated.spring(panX, { toValue: 0, useNativeDriver: true, friction: 5 }),
        Animated.spring(panY, { toValue: 0, useNativeDriver: true, friction: 5 }),
      ]).start();
      const cancelled = gs.dx < LEFT_THRESHOLD;
      finish(!cancelled);
    },
    onPanResponderTerminate: () => {
      if (!lockedRef.current) finish(false);
    },
  })).current;

  // ── Render ─────────────────────────────────────────────────────────────
  //
  // Idle: show whatever the parent supplied (mic icon inside the composer).
  // Recording (unlocked): overlay a horizontal row across the composer with
  //   [🗑]  ~ waveform ~  0:12   ← slide to cancel   [🎙 pulled by pan]
  // Recording (locked): show a static row with pause + trash + send.
  if (!recording) {
    // The idle mic — wrap it in the PanResponder so hold triggers.
    return (
      <View {...responder.panHandlers} style={W.idleWrap}>
        <Animated.View style={{ transform: [{ scale: micPulse }] }}>
          {idleContent}
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={W.overlay}>
      {/* Left: trash affordance that grows as user drags into the cancel zone */}
      <Animated.View style={{ transform: [{ scale: trashScale }] }}>
        <Ionicons name="trash-outline" size={22} color={ct.danger || '#EF4444'} />
      </Animated.View>

      {/* Middle: waveform + timer */}
      <View style={W.waveWrap}>
        {waveform.slice(-24).map((h, i) => (
          <View key={i} style={{
            width: 2.5, height: h, marginHorizontal: 1.5, borderRadius: 2,
            backgroundColor: paused ? ct.textDim : (ct.accent || '#3B82F6'),
          }} />
        ))}
      </View>
      <Text style={[W.timer, { color: ct.textPrimary || '#fff' }]}>
        {fmtDuration(durationMs)}
      </Text>

      {/* Right: locked → pause/send; unlocked → mic that follows the pan */}
      {locked ? (
        <View style={W.lockedActions}>
          <TouchableOpacity onPress={() => finish(false)} style={W.actionBtn}>
            <Ionicons name="trash-outline" size={22} color={ct.danger || '#EF4444'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={paused ? resume : pause} style={W.actionBtn}>
            <Ionicons name={paused ? 'play' : 'pause'} size={22} color={ct.textPrimary || '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => finish(true)} style={W.actionBtn}>
            <LinearGradient colors={ct.sendGrad || ['#3B82F6', '#2563EB']} style={W.sendCircle}>
              <Ionicons name="send" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Slide-to-cancel hint (fades as user drags left) */}
          <Animated.Text style={[W.slideHint, { color: ct.textSecondary || 'rgba(255,255,255,0.6)', opacity: cancelHintOp }]}>
            ← Slide to cancel
          </Animated.Text>

          {/* Lock affordance floating above the mic — glows brighter as user
              slides upward. */}
          <Animated.View
            pointerEvents="none"
            style={[W.lockHint, { opacity: lockGlow }]}
          >
            <View style={[W.lockCircle, { borderColor: ct.accent }]}>
              <Ionicons name="lock-closed" size={14} color={ct.accent} />
            </View>
            <Ionicons name="chevron-up" size={16} color={ct.accent} style={{ marginTop: 4 }} />
          </Animated.View>

          {/* The active mic — follows the pan */}
          <Animated.View
            {...responder.panHandlers}
            style={{ transform: [{ translateX: panX }, { translateY: panY }, { scale: 1.15 }] }}
          >
            <LinearGradient colors={ct.sendGrad || ['#3B82F6', '#2563EB']} style={W.micCircle}>
              <Ionicons name="mic" size={22} color="#fff" />
            </LinearGradient>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const W = StyleSheet.create({
  idleWrap: { justifyContent: 'center', alignItems: 'center' },

  overlay: {
    flexDirection: 'row', alignItems: 'center',
    flex: 1, paddingHorizontal: 6,
  },
  waveWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 10, height: 28,
  },
  timer: { fontSize: 13, fontWeight: '700', marginRight: 8 },

  slideHint: {
    position: 'absolute', right: 60, left: 50, textAlign: 'center', fontSize: 12,
  },

  lockHint: {
    position: 'absolute', right: 6, bottom: 54, alignItems: 'center',
  },
  lockCircle: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.10)',
  },

  micCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#2563EB', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },

  lockedActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn:     { padding: 8, marginHorizontal: 2 },
  sendCircle:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
