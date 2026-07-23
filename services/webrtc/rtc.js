// truevision/services/webrtc/rtc.js
//
// The single boundary between the app and the `react-native-webrtc` native
// module. EVERYTHING WebRTC goes through here so the rest of the app never
// imports the native package directly.
//
// Why this matters: `react-native-webrtc` is a NATIVE module. It only exists in
// a custom Development Build / production binary — NOT in Expo Go. We therefore
//   1. gate on `NativeModules.WebRTCModule` (the native side) BEFORE requiring
//      the JS, so in Expo Go the package is never even loaded, and
//   2. lazy-require it (only when a call actually starts),
// which means adding calling never breaks the current Expo Go bundle: it simply
// reports `isWebRTCAvailable() === false` and the UI shows a graceful notice.
//
// In a dev/prod build the native module is present → full functionality.

import { NativeModules } from 'react-native';

let cached; // undefined = not tried yet, null = unavailable, object = loaded

const load = () => {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line import/no-unresolved, global-require
    cached = require('react-native-webrtc');
  } catch (_) {
    cached = null;
  }
  return cached;
};

/** True only when the native WebRTC module is actually linked (dev/prod build). */
export const isWebRTCAvailable = () => {
  if (!NativeModules.WebRTCModule) return false; // Expo Go / not linked
  const m = load();
  return !!(m && m.RTCPeerConnection && m.mediaDevices);
};

/** The react-native-webrtc module, or null if unavailable. */
export const getWebRTC = () => {
  if (!NativeModules.WebRTCModule) return null;
  return load();
};

// ── Optional: react-native-incall-manager ──────────────────────────────────
// Handles audio routing (earpiece ↔ speaker), the proximity sensor, and
// ringback/ringtone. Also optional — if it isn't installed, calls still work
// through the default audio route; only the speaker toggle becomes a no-op.
let icmCached;
export const getInCallManager = () => {
  if (icmCached !== undefined) return icmCached;
  try {
    // eslint-disable-next-line import/no-unresolved, global-require
    icmCached = require('react-native-incall-manager').default;
  } catch (_) {
    icmCached = null;
  }
  return icmCached;
};
