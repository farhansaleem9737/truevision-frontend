// truevision/services/SocketService.js
//
// Singleton Socket.IO client. Call connect(token) once after login,
// then use on/off/emit from any screen.

import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_URL } from './config';

let socket = null;
let connecting = null;   // de-dupes concurrent connect() calls during handshake

const socketService = {
  /** Connect (or reconnect) with the user's JWT.
   *  Idempotent — safe to call from multiple places (AuthContext, ChatScreen,
   *  ChatConversationScreen) without spawning duplicate sockets. */
  connect: async () => {
    if (socket?.connected) return socket;
    if (connecting) return connecting;   // a handshake is already in flight

    connecting = (async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.warn('[Socket] No auth token — skipping connection');
        return null;
      }

      console.log('[Socket] Connecting to', SERVER_URL);

      socket = io(SERVER_URL, {
        auth: { token },
        // websocket-first, fall back to long-polling if it fails.
        // Mobile networks / corporate WiFi sometimes block raw WS upgrades —
        // polling gets us through. Socket.IO will upgrade once stable.
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 15000,
      });

      socket.on('connect', () => {
        console.log('[Socket] Connected:', socket.id, '| transport:', socket.io.engine.transport.name);
      });

      socket.on('connect_error', (err) => {
        // err.message is often just "websocket error" — log the description
        // and the URL so the cause is obvious (server down, wrong IP, etc).
        console.warn(
          '[Socket] Connection error:',
          err.message,
          '| target:', SERVER_URL,
          '| detail:', err.description?.message || err.description || 'n/a',
        );
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

  /** Disconnect and clean up. */
  disconnect: () => {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
  },

  /** Get the current socket instance (may be null). */
  getSocket: () => socket,

  /** Emit an event. */
  emit: (event, data, ack) => {
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
