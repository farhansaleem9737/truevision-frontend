// truevision/services/ChatService.js
//
// Client-side chat API. Two axios instances:
//   • `api`         — normal REST (15 s timeout)
//   • `uploadApi`   — Cloudinary direct uploads (60 s timeout, onUploadProgress)
//
// Every mutating endpoint accepts a callback where useful (uploads) or is
// idempotent by design (send, react — server uses clientMsgId / toggle).

import axios from 'axios';
import { API_URL } from './config';
import { attachSessionGuard } from './sessionGuard';

const BASE_URL = API_URL;

const api       = axios.create({ baseURL: BASE_URL, timeout: 15000 });
const uploadApi = axios.create({ baseURL: BASE_URL, timeout: 60000 });

attachSessionGuard(api);
attachSessionGuard(uploadApi);

// ── Cloudinary direct-upload helper (used by image/voice/document/gif) ────
//   Two-step: (1) fetch signed params from our backend, (2) POST bytes to
//   Cloudinary. Rejects file:// URIs indirectly — we never store the local
//   path on the server; only the returned secure_url + public_id.
const cloudinaryUpload = async (fileUri, kind, {
  mimeType, name, onProgress,
} = {}) => {
  try {
    const sigRes = await api.get('/users/media-signature', { params: { kind } });
    if (!sigRes.data?.success) {
      return { success: false, message: sigRes.data?.message || 'Failed to prepare upload' };
    }
    const { signature, timestamp, folder, resourceType, api_key, cloud_name } = sigRes.data;
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloud_name}/${resourceType}/upload`;

    // Cloudinary resource types:
    //   image   → images (jpg/png/webp)
    //   video   → mp4, m4a, audio (voice notes upload as video type — that's
    //             Cloudinary's convention for A/V assets).
    //   raw     → documents (pdf/docx/xlsx/zip)
    const formData = new FormData();
    formData.append('file',      { uri: fileUri, type: mimeType, name });
    formData.append('api_key',   api_key);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    formData.append('folder',    folder);

    // XHR gives real progress; fetch doesn't expose upload progress reliably
    // in React Native. Wrapped in a Promise so callers get a normal await.
    const upResp = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', cloudinaryUrl);
      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded / e.total);
        };
      }
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
        } catch (e) { reject(e); }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });

    if (!upResp.ok || !upResp.data.secure_url) {
      return { success: false, message: upResp.data?.error?.message || `HTTP ${upResp.status}` };
    }
    return {
      success:  true,
      url:      upResp.data.secure_url,
      publicId: upResp.data.public_id,
      width:    upResp.data.width    || 0,
      height:   upResp.data.height   || 0,
      duration: upResp.data.duration || 0,
      bytes:    upResp.data.bytes    || 0,
    };
  } catch (e) {
    console.error('[cloudinaryUpload]', e.message);
    return { success: false, message: e.message };
  }
};

// A tiny id helper — clientMsgId for idempotent sends. Not a real UUIDv4,
// but the space is more than large enough for per-user collision avoidance.
const clientMsgId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const chatService = {
  // ── Chats ────────────────────────────────────────────────────────────────
  getMyChats: async ({ archived = false } = {}) => {
    try {
      const res = await api.get('/chats', { params: archived ? { archived: 1 } : {} });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  createOrGetChat: async (userId) => {
    try {
      const res = await api.post('/chats', { userId });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // ── Per-chat state ──────────────────────────────────────────────────────
  togglePinChat:    async (chatId) => (await api.patch(`/chats/${chatId}/pin`)).data,
  // duration: '8h' | '24h' | '1w' | 'always' | 'off' | undefined (plain toggle).
  toggleMuteChat:   async (chatId, duration) =>
    (await api.patch(`/chats/${chatId}/mute`, duration ? { duration } : {})).data,
  toggleArchive:    async (chatId) => (await api.patch(`/chats/${chatId}/archive`)).data,
  // opts.undo:true removes the clear horizon again (restores the messages) —
  // powers the "Undo" snackbar right after a clear.
  clearChatHistory: async (chatId, { undo } = {}) =>
    (await api.delete(`/chats/${chatId}/history`, undo ? { data: { undo: true } } : undefined)).data,

  // Report a user to moderation. reason ∈ spam|harassment|fake|inappropriate|other.
  reportUser: async (userId, reason, details) =>
    (await api.post(`/users/${userId}/report`, { reason, details })).data,

  // ── Messages ────────────────────────────────────────────────────────────
  getMessages: async (chatId, { page = 1, before } = {}) => {
    try {
      const params = before ? { before } : { page };
      const res = await api.get(`/chats/${chatId}/messages`, { params });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  sendMessage: async (chatId, payload = {}) => {
    try {
      const body = { clientMsgId: payload.clientMsgId || clientMsgId(), ...payload };
      const res = await api.post(`/chats/${chatId}/messages`, body);
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  editMessage: async (chatId, messageId, text) => {
    try {
      const res = await api.patch(`/chats/${chatId}/messages/${messageId}`, { text });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Failed to edit' };
    }
  },

  deleteMessage: async (chatId, messageId, scope = 'me') => {
    try {
      const res = await api.delete(`/chats/${chatId}/messages/${messageId}`, { params: { scope } });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  reactToMessage: async (chatId, messageId, emoji) => {
    try {
      const res = await api.post(`/chats/${chatId}/messages/${messageId}/react`, { emoji });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Failed to react' };
    }
  },

  toggleStarMessage: async (chatId, messageId) => {
    try {
      const res = await api.post(`/chats/${chatId}/messages/${messageId}/star`);
      return res.data;
    } catch (e) {
      return { success: false };
    }
  },

  togglePinMessage: async (chatId, messageId) => {
    try {
      const res = await api.post(`/chats/${chatId}/messages/${messageId}/pin`);
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Failed to pin' };
    }
  },

  forwardMessages: async ({ messageIds, toChatIds }) => {
    try {
      const res = await api.post('/chats/forward', { messageIds, toChatIds });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Failed to forward' };
    }
  },

  searchMessages: async (chatId, q) => {
    try {
      const res = await api.get(`/chats/${chatId}/messages/search`, { params: { q } });
      return res.data;
    } catch (e) {
      return { success: false, messages: [] };
    }
  },

  markAsRead: async (chatId) => {
    try {
      const res = await api.put(`/chats/${chatId}/read`);
      return res.data;
    } catch (e) {
      return { success: false };
    }
  },

  // ── Uploads ─────────────────────────────────────────────────────────────
  //
  // ROOT CAUSE of the "images don't load" bug was sending the local file://
  // URI to the backend. Every upload helper below returns a Cloudinary
  // secure_url + public_id — anything sent to /messages carries only those.

  uploadChatImage: (fileUri, opts = {}) =>
    cloudinaryUpload(fileUri, 'chat-image', {
      mimeType: opts.mimeType || 'image/jpeg',
      name:     opts.name     || `chat-${Date.now()}.jpg`,
      onProgress: opts.onProgress,
    }),

  uploadChatVoice: (fileUri, opts = {}) =>
    cloudinaryUpload(fileUri, 'chat-voice', {
      mimeType: opts.mimeType || 'audio/m4a',
      name:     opts.name     || `voice-${Date.now()}.m4a`,
      onProgress: opts.onProgress,
    }),

  uploadChatDocument: (fileUri, opts = {}) =>
    cloudinaryUpload(fileUri, 'chat-doc', {
      mimeType: opts.mimeType || 'application/octet-stream',
      name:     opts.name     || `doc-${Date.now()}`,
      onProgress: opts.onProgress,
    }),

  // ── Push notifications ──────────────────────────────────────────────────
  registerPushToken: async (token, platform = 'expo') => {
    try {
      const res = await api.post('/users/push-token', { token, platform });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Failed' };
    }
  },

  unregisterPushToken: async (token, platform = 'expo') => {
    try {
      const res = await api.delete('/users/push-token', { data: { token, platform } });
      return res.data;
    } catch (e) {
      return { success: false };
    }
  },

  // ── Users ───────────────────────────────────────────────────────────────
  searchUsers: async (query) => {
    try {
      const res = await api.get('/users/search', { params: { q: query } });
      return res.data;
    } catch (e) {
      return { success: false, users: [] };
    }
  },

  // ── Helpers ─────────────────────────────────────────────────────────────
  clientMsgId,
};

export default chatService;
