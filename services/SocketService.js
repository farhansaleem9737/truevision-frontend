// truevision/services/SocketService.js
//
// Singleton Socket.IO client. Call connect(token) once after login,
// then use on/off/emit from any screen.

import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_URL } from './config';

let socket = null;

const socketService = {
  /** Connect (or reconnect) with the user's JWT. */
  connect: async () => {
    if (socket?.connected) return socket;

    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      console.warn('[Socket] No auth token — skipping connection');
      return null;
    }

    socket = io(SERVER_URL, {
      auth: { token },
      transports: ['websocket'],       // skip polling — faster on mobile
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 15000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    return socket;
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
