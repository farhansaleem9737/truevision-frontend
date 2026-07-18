// truevision/services/SocketService.js
//
// Singleton Socket.IO client. Call connect() once after login; use on/off/emit
// from any screen.
//
// Hardening:
//   • CALLBACK-based auth — every (re)connect reads the LATEST access token
//     from storage, so a refreshed token is used automatically (never a stale
//     JWT replayed on reconnect).
//   • Auth-failure recovery — a handshake rejection first tries a token refresh;
//     only if that fails is it a real logout. Transient network connect_errors
//     never log the user out.
//   • Room restoration — joined chat rooms are re-joined on every reconnect so
//     realtime updates aren't silently lost after a drop.

import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_URL } from './config';
import { invalidateSession, refreshSession } from './sessionGuard';

let socket = null;
let connecting = null;              // de-dupes concurrent connect() calls
const joinedRooms = new Set();     // chat rooms to restore on reconnect
let handlingAuthError = false;     // de-dupes auth-error recovery per episode

// Handshake rejection messages (Backend/socket.js) that mean an AUTH problem
// (vs a network hiccup like "websocket error" / "timeout" / "xhr poll error").
const AUTH_ERROR_NEEDLES = [
  'authentication required', 'invalid token', 'session ended',
  'session expired', 'user not found',
];
const isAuthError = (msg) => {
  const m = String(msg || '').toLowerCase();
  return AUTH_ERROR_NEEDLES.some((s) => m.includes(s));
};

// On an auth handshake failure: try ONE refresh. If it works, the auto-reconnect
// (callback auth) picks up the new token and the 'connect' handler clears the
// flag. If it fails, the session is genuinely over → graceful logout.
const handleAuthFailure = async (reason) => {
  if (handlingAuthError) return;
  handlingAuthError = true;
  const newToken = await refreshSession();
  if (!newToken) {
    invalidateSession({ code: 'TOKEN_INVALID', reason: reason || 'Session ended' });
    // stays flagged; the app navigates to login and disconnect() clears state.
  }
  // On success, keep the flag until 'connect' resets it so we refresh at most
  // once per failure episode; the pending auto-reconnect will use the new token.
};

const socketService = {
  connect: async () => {
    if (socket?.connected) return socket;
    if (connecting) return connecting;

    connecting = (async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.warn('[Socket] No auth token — skipping connection');
        return null;
      }

      console.log('[Socket] Connecting to', SERVER_URL);

      socket = io(SERVER_URL, {
        // Function form → re-reads the freshest token on every reconnect.
        auth: (cb) => {
          AsyncStorage.getItem('authToken')
            .then((t) => cb({ token: t }))
            .catch(() => cb({}));
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 15000,
      });

      socket.on('connect', () => {
        console.log('[Socket] Connected:', socket.id, '| transport:', socket.io.engine.transport.name);
        handlingAuthError = false;
        // Restore room subscriptions lost on the previous socket/reconnect.
        for (const room of joinedRooms) socket.emit('joinChat', room);
      });

      socket.on('connect_error', (err) => {
        console.warn('[Socket] connect_error:', err.message, '| target:', SERVER_URL);
        if (isAuthError(err.message)) handleAuthFailure(err.message);
        // else: transient network error — let Socket.IO keep retrying.
      });

      // Server-initiated revocation (password change / logout-all sever sockets).
      socket.on('sessionRevoked', () => handleAuthFailure('session ended'));
      socket.on('unauthorized',   () => handleAuthFailure('invalid token'));
      socket.on('tokenExpired',   () => handleAuthFailure('session expired'));

      // Exhausted all reconnection attempts — almost always a network outage.
      // Do NOT force logout here (reliability); the REST 401 path catches a
      // genuinely dead session. A later connect() call resumes retrying.
      socket.io.on('reconnect_failed', () => {
        console.warn('[Socket] reconnect_failed — network unreachable; will resume on next connect()');
      });

      socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
      });

      return socket;
    })();

    try {
      return await connecting;
    } finally {
      connecting = null;
    }
  },

  /** Disconnect and clean up. Clears tracked rooms so a fresh login starts clean. */
  disconnect: () => {
    joinedRooms.clear();
    handlingAuthError = false;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
  },

  /** Get the current socket instance (may be null). */
  getSocket: () => socket,

  /** Emit an event. Tracks chat-room membership so it can be restored on reconnect. */
  emit: (event, data, ack) => {
    if (event === 'joinChat'  && data) joinedRooms.add(data);
    if (event === 'leaveChat' && data) joinedRooms.delete(data);
    if (!socket?.connected) {
      console.warn(`[Socket] Not connected — cannot emit "${event}"`);
      return;
    }
    socket.emit(event, data, ack);
  },

  /** Subscribe to an event. Returns an unsubscribe function. */
  on: (event, handler) => {
    if (!socket) return () => {};
    socket.on(event, handler);
    return () => socket?.off(event, handler);
  },

  /** Unsubscribe from an event. */
  off: (event, handler) => {
    socket?.off(event, handler);
  },
};

export default socketService;
