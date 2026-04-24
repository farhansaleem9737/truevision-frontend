// truevision/services/ChatService.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

const BASE_URL = API_URL;

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const chatService = {
  // ── Chats ──────────────────────────────────────────────────────────────────
  /** Fetch all chats for the logged-in user. */
  getMyChats: async () => {
    try {
      const res = await api.get('/chats');
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  /** Create (or get existing) 1-on-1 chat with another user. */
  createOrGetChat: async (userId) => {
    try {
      const res = await api.post('/chats', { userId });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // ── Messages ───────────────────────────────────────────────────────────────
  /** Fetch paginated messages for a chat. */
  getMessages: async (chatId, page = 1) => {
    try {
      const res = await api.get(`/chats/${chatId}/messages`, { params: { page } });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  /** Send a message via REST (fallback if socket is down). */
  sendMessage: async (chatId, { text, type = 'text', videoId, imageUrl }) => {
    try {
      const res = await api.post(`/chats/${chatId}/messages`, { text, type, videoId, imageUrl });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  /** Mark all messages in a chat as read. */
  markAsRead: async (chatId) => {
    try {
      const res = await api.put(`/chats/${chatId}/read`);
      return res.data;
    } catch (e) {
      return { success: false };
    }
  },

  /** Delete / unsend a message. */
  deleteMessage: async (chatId, messageId) => {
    try {
      const res = await api.delete(`/chats/${chatId}/messages/${messageId}`);
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // ── User search ────────────────────────────────────────────────────────────
  /** Search users by username or display name. */
  searchUsers: async (query) => {
    try {
      const res = await api.get('/users/search', { params: { q: query } });
      return res.data;
    } catch (e) {
      return { success: false, users: [] };
    }
  },
};

export default chatService;
