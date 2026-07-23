// truevision/screens/CallScreen.js
//
// Full-screen call overlay (voice + video). Rendered by CallProvider whenever a
// call is active, so it appears above whatever screen you're on and also
// surfaces incoming calls from anywhere.
//
// It reads all state + actions from useCall(); it contains NO WebRTC logic.
// RTCView is pulled from the guarded native boundary at render time (never a
// static import), so this file is safe to load in Expo Go — where it shows a
// graceful "needs a dev build" notice instead of crashing.

import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useCall } from '../context/CallProvider';
import { getWebRTC } from '../services/webrtc/rtc';

const initials = (n) => (n || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
const fmtTimer = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

const endLabel = (reason) => ({
  declined:    'Call declined',
  busy:        'User is busy',
  missed:      'No answer',
  unavailable: 'User is unavailable',
  failed:      'Call failed',
  permission:  'Camera / microphone permission denied',
  unsupported: 'Calling needs the TrueVision app',
  ended:       'Call ended',
}[reason] || 'Call ended');

// ── Peer avatar (image or initials) ──────────────────────────────────────────
function PeerAvatar({ peer, size }) {
  if (peer?.profileImage) {
    return <ExpoImage source={{ uri: peer.profileImage }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.34 }}>{initials(peer?.fullName || peer?.username)}</Text>
    </View>
  );
}

// ── Round control button ─────────────────────────────────────────────────────
function CtrlBtn({ icon, label, onPress, active, danger, positive, iconRotate, size = 62 }) {
  return (
    <TouchableOpacity style={styles.ctrlWrap} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[
        styles.ctrl,
        { width: size, height: size, borderRadius: size / 2 },
        active && styles.ctrlActive,
        positive && styles.ctrlPositive,
        danger && styles.ctrlDanger,
      ]}>
        <Ionicons name={icon} size={26} color={active ? '#0B141A' : '#fff'}
          style={iconRotate ? { transform: [{ rotate: `${iconRotate}deg` }] } : undefined} />
      </View>
      {label ? <Text style={styles.ctrlLabel}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

export default function CallScreen() {
  const call = useCall();
  const { state } = call;
  const {
    status, direction, mode, peer, muted, speakerOn, cameraOff,
    startedAt, endReason, localStream, remoteStream, available,
  } = state;

  // Live call timer.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (status !== 'connected' || !startedAt) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status, startedAt]);

  const RTCView = getWebRTC()?.RTCView;
  const isVideo = mode === 'video';
  const showRemoteVideo = isVideo && status === 'connected' && remoteStream && RTCView;
  const showLocalVideo  = isVideo && localStream && RTCView && !cameraOff
    && ['connected', 'connecting', 'reconnecting', 'outgoing'].includes(status);

  // Subtitle under the name.
  let subtitle = '';
  if (status === 'ended') subtitle = endLabel(endReason);
  else if (!available)     subtitle = endLabel('unsupported');
  else if (status === 'incoming')     subtitle = `Incoming ${isVideo ? 'video' : 'voice'} call`;
  else if (status === 'outgoing')     subtitle = 'Ringing…';
  else if (status === 'connecting')   subtitle = 'Connecting…';
  else if (status === 'reconnecting') subtitle = 'Reconnecting…';
  else if (status === 'connected')    subtitle = fmtTimer(elapsed);

  const ended = status === 'ended';

  return (
    <Modal visible transparent={false} animationType="slide" statusBarTranslucent onRequestClose={() => {}}>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        {/* Remote video fills the screen; avatar view otherwise. */}
        {showRemoteVideo ? (
          <RTCView streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" />
        ) : (
          <View style={styles.avatarStage}>
            <PeerAvatar peer={peer} size={132} />
          </View>
        )}

        {/* Local self-view (PiP) for video calls */}
        {showLocalVideo ? (
          <View style={styles.pip}>
            <RTCView streamURL={localStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" mirror zOrder={1} />
          </View>
        ) : null}

        <SafeAreaView style={styles.safe} pointerEvents="box-none">
          {/* Header: name + status */}
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {peer?.fullName || peer?.username || 'Unknown'}
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {/* Bottom controls */}
          <View style={styles.controls}>
            {ended || !available ? (
              <CtrlBtn icon="close" label="Close" danger onPress={call.dismiss} />
            ) : status === 'incoming' ? (
              <View style={styles.incomingRow}>
                <CtrlBtn icon="call" label="Accept" positive onPress={call.accept} size={68} />
                <View style={{ width: 60 }} />
                <CtrlBtn icon="call" label="Decline" danger iconRotate={135} onPress={call.decline} size={68} />
              </View>
            ) : (
              <View style={styles.activeRow}>
                <CtrlBtn icon={muted ? 'mic-off' : 'mic'} label={muted ? 'Unmute' : 'Mute'} active={muted} onPress={call.toggleMute} />
                <CtrlBtn icon={speakerOn ? 'volume-high' : 'volume-medium'} label="Speaker" active={speakerOn} onPress={call.toggleSpeaker} />
                {isVideo && (
                  <>
                    <CtrlBtn icon={cameraOff ? 'videocam-off' : 'videocam'} label="Camera" active={cameraOff} onPress={call.toggleCamera} />
                    <CtrlBtn icon="camera-reverse" label="Flip" onPress={call.switchCamera} />
                  </>
                )}
                <CtrlBtn icon="call" label="End" danger iconRotate={135} onPress={call.hangup} />
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#0B141A' },
  safe:        { flex: 1, justifyContent: 'space-between' },
  avatarStage: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F6FEB' },

  pip: {
    position: 'absolute', top: 60, right: 16, width: 104, height: 150,
    borderRadius: 14, overflow: 'hidden', backgroundColor: '#000',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', zIndex: 5,
  },

  header:   { alignItems: 'center', paddingTop: 24, paddingHorizontal: 24 },
  name:     { color: '#fff', fontSize: 26, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginTop: 8, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },

  controls:    { paddingBottom: Platform.OS === 'ios' ? 24 : 34, paddingHorizontal: 16 },
  activeRow:   { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', flexWrap: 'wrap' },
  incomingRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },

  ctrlWrap:  { alignItems: 'center', marginHorizontal: 6, marginVertical: 6 },
  ctrl:      { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  ctrlActive:{ backgroundColor: '#fff' },
  ctrlPositive:{ backgroundColor: '#22C55E' },
  ctrlDanger:{ backgroundColor: '#EF4444' },
  ctrlLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 7, fontWeight: '600' },
});
