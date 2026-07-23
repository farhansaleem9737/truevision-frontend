// truevision/services/CallService.js
//
// One active voice/video call at a time. Owns the WebRTC PeerConnection and the
// Socket.IO signalling handshake; exposes a tiny pub/sub so the CallProvider /
// CallScreen can render state without knowing any WebRTC details.
//
// Signalling (relayed by Backend/socket.js):
//   caller  emits call:invite  { toUserId, callId, mode, sdp:offer }
//   callee  receives call:incoming, emits call:accept { toUserId, callId, sdp:answer }
//   caller  receives call:accepted
//   both    emit/receive call:ice { candidate }
//   decline / busy / cancel / end / unavailable close the call
//
// Media is peer-to-peer (STUN; add a TURN server for strict NATs — see
// ICE_SERVERS below). The native module only exists in a dev/prod build, so
// everything degrades gracefully in Expo Go via services/webrtc/rtc.js.

import { Platform, PermissionsAndroid } from 'react-native';
import socketService from './SocketService';
import { getWebRTC, getInCallManager, isWebRTCAvailable } from './webrtc/rtc';

// Public STUN. For production reliability behind symmetric NATs, add a TURN
// entry here (url + username + credential).
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // { urls: 'turn:your.turn.server:3478', username: '…', credential: '…' },
];

const VIDEO_CONSTRAINTS = {
  audio: true,
  video: { width: 1280, height: 720, frameRate: 30, facingMode: 'user' },
};
const AUDIO_CONSTRAINTS = { audio: true, video: false };

const newCallId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

class CallService {
  constructor() {
    this.listeners   = new Set();
    this.boundSocket = null;   // the socket instance our handlers are bound to

    this.pc          = null;
    this.localStream = null;
    this.remoteStream = null;
    this.pendingCandidates = []; // remote ICE that arrived before remoteDescription

    this._reset();
  }

  _reset() {
    this.status    = 'idle';   // idle | outgoing | incoming | connecting | connected | reconnecting | ended
    this.direction = null;     // 'outgoing' | 'incoming'
    this.mode      = 'audio';  // 'audio' | 'video'
    this.peer      = null;     // { _id, username, fullName, profileImage }
    this.callId    = null;
    this.offer     = null;     // pending remote offer (incoming, pre-accept)
    this.muted     = false;
    this.speakerOn = false;
    this.cameraOff = false;
    this.startedAt = null;     // ms when connected
    this.endReason = null;     // 'declined' | 'busy' | 'missed' | 'ended' | 'failed' | 'unavailable'
  }

  // ── pub/sub ───────────────────────────────────────────────────────────────
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  snapshot() {
    return {
      status: this.status, direction: this.direction, mode: this.mode,
      peer: this.peer, callId: this.callId,
      muted: this.muted, speakerOn: this.speakerOn, cameraOff: this.cameraOff,
      startedAt: this.startedAt, endReason: this.endReason,
      localStream: this.localStream, remoteStream: this.remoteStream,
      available: isWebRTCAvailable(),
    };
  }

  _emit() {
    const snap = this.snapshot();
    this.listeners.forEach((fn) => { try { fn(snap); } catch (_) {} });
  }

  _set(patch) { Object.assign(this, patch); this._emit(); }

  // ── Socket signalling wiring ────────────────────────────────────────────────
  // Binds the call:* listeners to the CURRENT connected socket. connect() mints
  // a new socket per login and socketService.on() no-ops on a null socket, so we
  // (a) ensure the socket exists, and (b) re-bind whenever the instance changes
  // (re-login). Automatic reconnects reuse the same instance and keep handlers.
  async attachSocketHandlers() {
    let s = socketService.getSocket();
    if (!s) { try { s = await socketService.connect(); } catch (_) { s = socketService.getSocket(); } }
    if (!s || this.boundSocket === s) return;
    this.boundSocket = s;

    socketService.on('call:incoming',   (d) => this._onIncoming(d));
    socketService.on('call:accepted',   (d) => this._onAccepted(d));
    socketService.on('call:declined',   (d) => this._onRemoteClose(d, 'declined'));
    socketService.on('call:busy',       (d) => this._onRemoteClose(d, 'busy'));
    socketService.on('call:cancelled',  (d) => this._onRemoteClose(d, 'missed'));
    socketService.on('call:ended',      (d) => this._onRemoteClose(d, 'ended'));
    socketService.on('call:unavailable',(d) => this._onRemoteClose(d, 'unavailable'));
    socketService.on('call:ice',        (d) => this._onRemoteIce(d));
  }

  // ── Outgoing ───────────────────────────────────────────────────────────────
  async placeCall(peer, mode = 'audio') {
    if (!isWebRTCAvailable()) {
      // Expo Go / no native module — show a graceful notice instead of crashing.
      this._set({ status: 'ended', endReason: 'unsupported', peer, mode });
      return;
    }
    if (this.status !== 'idle') return; // already in a call

    await this.attachSocketHandlers();
    this._reset();
    this._set({ status: 'outgoing', direction: 'outgoing', mode, peer, callId: newCallId() });

    try {
      await this._startMedia(mode);
      this._createPeer();
      this.localStream.getTracks().forEach((t) => this.pc.addTrack(t, this.localStream));

      const offer = await this.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: mode === 'video' });
      await this.pc.setLocalDescription(offer);

      socketService.emit('call:invite', {
        toUserId: peer._id, callId: this.callId, mode,
        sdp: { type: this.pc.localDescription.type, sdp: this.pc.localDescription.sdp },
      });
      this._startRingback('outgoing');
    } catch (err) {
      console.warn('[call] placeCall failed:', err?.message);
      this._teardown(err?.code === 'permission-denied' ? 'permission' : 'failed');
    }
  }

  // ── Incoming ────────────────────────────────────────────────────────────────
  _onIncoming({ callId, mode, sdp, from }) {
    // Busy → auto-decline the newcomer, keep the current call.
    if (this.status !== 'idle') {
      socketService.emit('call:busy', { toUserId: from?._id, callId });
      return;
    }
    this._reset();
    this._set({
      status: 'incoming', direction: 'incoming', mode: mode === 'video' ? 'video' : 'audio',
      peer: from, callId, offer: sdp,
    });
    this._startRingback('incoming');
  }

  async acceptIncoming() {
    if (this.status !== 'incoming') return;
    this._stopRingback();
    this._set({ status: 'connecting' });
    try {
      await this._startMedia(this.mode);
      this._createPeer();
      this.localStream.getTracks().forEach((t) => this.pc.addTrack(t, this.localStream));

      const { RTCSessionDescription } = getWebRTC();
      await this.pc.setRemoteDescription(new RTCSessionDescription(this.offer));
      await this._flushCandidates();

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      socketService.emit('call:accept', {
        toUserId: this.peer._id, callId: this.callId,
        sdp: { type: this.pc.localDescription.type, sdp: this.pc.localDescription.sdp },
      });
    } catch (err) {
      console.warn('[call] acceptIncoming failed:', err?.message);
      this._teardown(err?.code === 'permission-denied' ? 'permission' : 'failed');
    }
  }

  declineIncoming() {
    if (this.status !== 'incoming') return;
    socketService.emit('call:decline', { toUserId: this.peer?._id, callId: this.callId });
    this._teardown('declined');
  }

  // Dismiss the ended/unsupported overlay (returns to idle).
  dismiss() {
    if (this.status === 'ended') { this._reset(); this._emit(); }
  }

  // Local hang-up. Cancels a not-yet-answered outgoing call, else ends it.
  hangup() {
    if (this.status === 'idle' || this.status === 'ended') return;
    if (this.status === 'outgoing') {
      socketService.emit('call:cancel', { toUserId: this.peer?._id, callId: this.callId });
    } else if (this.peer?._id) {
      const durationSec = this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0;
      socketService.emit('call:end', { toUserId: this.peer._id, callId: this.callId, durationSec });
    }
    this._teardown('ended');
  }

  // ── Remote signalling handlers ──────────────────────────────────────────────
  async _onAccepted({ callId, sdp }) {
    if (callId !== this.callId || this.status !== 'outgoing') return;
    try {
      const { RTCSessionDescription } = getWebRTC();
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this._flushCandidates();
      this._stopRingback();
      this._set({ status: 'connecting' });
    } catch (err) {
      console.warn('[call] onAccepted failed:', err?.message);
      this._teardown('failed');
    }
  }

  _onRemoteClose({ callId }, reason) {
    if (callId && callId !== this.callId) return;
    this._teardown(reason);
  }

  async _onRemoteIce({ callId, candidate }) {
    if (callId !== this.callId || !candidate) return;
    const wrtc = getWebRTC();
    if (!wrtc) return;
    const cand = new wrtc.RTCIceCandidate(candidate);
    if (this.pc && this.pc.remoteDescription) {
      try { await this.pc.addIceCandidate(cand); } catch (_) {}
    } else {
      this.pendingCandidates.push(cand); // buffer until remoteDescription is set
    }
  }

  async _flushCandidates() {
    while (this.pendingCandidates.length) {
      const c = this.pendingCandidates.shift();
      try { await this.pc.addIceCandidate(c); } catch (_) {}
    }
  }

  // ── Media + peer connection ─────────────────────────────────────────────────
  async _startMedia(mode) {
    await this._ensurePermissions(mode);
    const { mediaDevices } = getWebRTC();
    this.localStream = await mediaDevices.getUserMedia(mode === 'video' ? VIDEO_CONSTRAINTS : AUDIO_CONSTRAINTS);
    // Video calls default to speaker; voice calls to the earpiece.
    this.speakerOn = mode === 'video';
    this._applyAudioRoute();
  }

  // Android needs runtime mic (+ camera for video) grants before getUserMedia.
  // iOS prompts automatically via the Info.plist usage strings. Throws if denied.
  async _ensurePermissions(mode) {
    if (Platform.OS !== 'android') return;
    const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
    if (mode === 'video') perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    const res = await PermissionsAndroid.requestMultiple(perms);
    const denied = perms.some((p) => res[p] !== PermissionsAndroid.RESULTS.GRANTED);
    if (denied) { const e = new Error('permission-denied'); e.code = 'permission-denied'; throw e; }
  }

  _createPeer() {
    const { RTCPeerConnection } = getWebRTC();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.addEventListener('icecandidate', (e) => {
      if (e.candidate && this.peer?._id) {
        socketService.emit('call:ice', { toUserId: this.peer._id, callId: this.callId, candidate: e.candidate });
      }
    });
    pc.addEventListener('track', (e) => {
      this.remoteStream = e.streams?.[0] || this.remoteStream;
      this._emit();
    });
    pc.addEventListener('connectionstatechange', () => {
      const s = pc.connectionState;
      if (s === 'connected') {
        if (!this.startedAt) this.startedAt = Date.now();
        this._set({ status: 'connected' });
      } else if (s === 'disconnected') {
        this._set({ status: 'reconnecting' }); // ICE may recover on its own
      } else if (s === 'failed') {
        this._teardown('failed');
      }
    });

    this.pc = pc;
  }

  // ── In-call controls ────────────────────────────────────────────────────────
  toggleMute() {
    this.muted = !this.muted;
    (this.localStream?.getAudioTracks() || []).forEach((t) => { t.enabled = !this.muted; });
    this._emit();
  }

  toggleCamera() {
    this.cameraOff = !this.cameraOff;
    (this.localStream?.getVideoTracks() || []).forEach((t) => { t.enabled = !this.cameraOff; });
    this._emit();
  }

  switchCamera() {
    const track = this.localStream?.getVideoTracks?.()[0];
    if (track && typeof track._switchCamera === 'function') track._switchCamera();
  }

  toggleSpeaker() {
    this.speakerOn = !this.speakerOn;
    this._applyAudioRoute();
    this._emit();
  }

  _applyAudioRoute() {
    const icm = getInCallManager();
    if (icm) { try { icm.setForceSpeakerphoneOn(this.speakerOn); } catch (_) {} }
  }

  // ── Ringback / ringtone (via InCallManager, best-effort) ────────────────────
  _startRingback(kind) {
    const icm = getInCallManager();
    if (!icm) return;
    try {
      icm.start({ media: this.mode === 'video' ? 'video' : 'audio' });
      if (kind === 'incoming') icm.startRingtone('_BUNDLE_');
      else icm.startRingback('_BUNDLE_');
    } catch (_) {}
  }

  _stopRingback() {
    const icm = getInCallManager();
    if (!icm) return;
    try { icm.stopRingback(); icm.stopRingtone(); } catch (_) {}
  }

  // ── Teardown ────────────────────────────────────────────────────────────────
  _teardown(reason) {
    this._stopRingback();
    const icm = getInCallManager();
    if (icm) { try { icm.stop(); } catch (_) {} }

    try { this.pc?.close(); } catch (_) {}
    (this.localStream?.getTracks?.() || []).forEach((t) => { try { t.stop(); } catch (_) {} });

    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.pendingCandidates = [];

    this._set({ status: 'ended', endReason: reason });
    // Return to idle shortly so the UI can show the end state, then dismiss.
    setTimeout(() => { if (this.status === 'ended') { this._reset(); this._emit(); } }, 1200);
  }
}

const callService = new CallService();
export default callService;
