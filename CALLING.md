# TrueVision — Voice & Video Calling

Real-time 1:1 voice and video calling built on **WebRTC** (`react-native-webrtc`)
with **Socket.IO** signalling. This document explains how it's wired and how to
turn it on.

## Why you need a Development Build

`react-native-webrtc` and `react-native-incall-manager` are **native modules**.
They do **not** exist in **Expo Go**. The app is written to detect this: in Expo
Go, pressing a call button shows a graceful *"Calling needs the TrueVision app"*
notice instead of crashing. To actually place calls you must run a **custom
Development Build** (or a production build).

The calling code never loads the native module unless it is present
(`services/webrtc/rtc.js` gates on `NativeModules.WebRTCModule`), so **adding
calling did not break the existing Expo Go workflow** — everything else keeps
working in Expo Go exactly as before.

## One-time setup: create a Development Build

From `truevision/`:

```bash
# Option A — EAS cloud build (recommended; no local Android/iOS toolchain needed)
npm install -g eas-cli          # if you don't have it
eas login
eas build --profile development --platform android   # or ios
# install the resulting .apk/.aab (or dev-client) on your device

# Option B — local prebuild + run (needs Android Studio / Xcode installed)
npx expo prebuild                # generates native android/ + ios/ from app.json
npx expo run:android             # or: npx expo run:ios
```

Then start the dev server for the dev client:

```bash
npx expo start --dev-client
```

The `@config-plugins/react-native-webrtc` plugin (already in `app.json`) injects
all required native permissions during prebuild:
- **Android:** `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`,
  `ACCESS_NETWORK_STATE`, `BLUETOOTH`, `WAKE_LOCK`
- **iOS:** `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`

No further code change is needed — calling activates automatically once the
native module is present.

## How it works

```
Caller                         Server (socket.js relay)              Callee
──────                         ────────────────────────              ──────
placeCall()                                                          
  getUserMedia + offer  ── call:invite {sdp} ──►  (block/presence)   
                                                 ── call:incoming ──► CallProvider shows CallScreen
                        ◄── call:accepted {sdp} ── call:accept {sdp} ◄─ acceptIncoming()
      ◄──────────────── call:ice (both directions) ──────────────►   
      ══════════════════ WebRTC P2P media (audio/video) ═══════════  
  hangup() ─────────── call:end ──►               ── call:ended ──►  teardown
```

- **Frontend**
  - `services/webrtc/rtc.js` — the ONLY place that touches `react-native-webrtc`
    (lazy, guarded). Also lazily loads `react-native-incall-manager` for audio
    routing (speaker) + ringtone.
  - `services/CallService.js` — one active call: PeerConnection, SDP/ICE
    exchange, mute / speaker / switch-camera / camera-off, timer, missed/busy/
    decline/reconnect handling.
  - `context/CallProvider.js` — binds the `call:*` socket listeners on login and
    renders the call overlay above every screen (so incoming calls surface
    anywhere). Start a call from any screen via `useCall().placeCall(peer, mode)`.
  - `screens/CallScreen.js` — the full-screen incoming / outgoing / in-call UI.
  - Entry points: the chat header voice/video buttons and the profile
    Call / Video buttons both call `callService.placeCall(peer, 'audio' | 'video')`.

- **Backend**
  - `socket.js` — pure signalling relay: `call:invite → call:incoming`,
    `call:accept → call:accepted`, `call:decline / busy / cancel / end`, and
    `call:ice` trickling. Blocks blocked pairs, and returns `call:unavailable`
    when the callee is offline.
  - `models/Call.js` — call-history log (ringing / answered / ended / declined /
    missed / busy + duration).

## Production note — TURN server

The default configuration uses public **STUN** servers only
(`services/CallService.js → ICE_SERVERS`). STUN is enough for most networks, but
calls between two strict/symmetric NATs need a **TURN** server. For production,
add a TURN entry (url + username + credential) to `ICE_SERVERS`. Nothing else
changes.

## Testing checklist (on two dev-build devices)

1. Sign in on two devices as two different users who can message each other.
2. From a chat or profile, tap the **voice** call button → the other device
   rings (incoming overlay). Accept → two-way audio.
3. Repeat with the **video** button → two-way video + local self-view PiP.
4. In-call: mute, speaker, switch camera, camera off, end — all update live.
5. Decline, cancel-before-answer (missed), and calling an **offline** user
   (unavailable) each show the right end state.
