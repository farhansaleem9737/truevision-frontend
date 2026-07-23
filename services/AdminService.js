// truevision/services/AdminService.js
//
// Client for the hidden Admin Moderation Panel. Completely separate from the
// app's user session: it keeps its OWN token (AsyncStorage key 'adminToken')
// and never touches sessionGuard / the user axios instances. Normal users who
// never log in here simply have no admin token.

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

const ADMIN_TOKEN_KEY = 'adminToken';

const api = axios.create({ baseURL: `${API_URL}/admin`, timeout: 15000 });

// Attach the admin token on every request.
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const adminService = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  async login(username, password, remember = true) {
    const res = await api.post('/login', { username, password, remember });
    if (res.data?.success && res.data.token) {
      await AsyncStorage.setItem(ADMIN_TOKEN_KEY, res.data.token);
    }
    return res.data;
  },
  async logout() {
    await AsyncStorage.removeItem(ADMIN_TOKEN_KEY);
  },
  async getToken() {
    return AsyncStorage.getItem(ADMIN_TOKEN_KEY);
  },
  async me() {
    const res = await api.get('/me');
    return res.data;
  },

  // ── Dashboard ───────────────────────────────────────────────────────────────
  async stats() {
    const res = await api.get('/stats');
    return res.data;
  },

  // ── Lists (server-side pagination / filter / search / sort) ──────────────────
  async listVideos({ status = 'blocked', q = '', page = 1, limit = 20, sort = 'new' } = {}) {
    const res = await api.get('/videos', { params: { status, q, page, limit, sort } });
    return res.data;
  },
  async listReviews({ status = 'pending', q = '', page = 1, limit = 20 } = {}) {
    const res = await api.get('/reviews', { params: { status, q, page, limit } });
    return res.data;
  },
  async videoDetail(videoId) {
    const res = await api.get(`/videos/${videoId}`);
    return res.data;
  },
  async auditLog({ page = 1, limit = 30, videoId } = {}) {
    const res = await api.get('/audit', { params: { page, limit, videoId } });
    return res.data;
  },

  // ── Actions ──────────────────────────────────────────────────────────────────
  //   action ∈ approve | reject | request_changes | delete | warn | suspend
  async act(videoId, action, note = '') {
    const res = await api.post(`/videos/${videoId}/action`, { action, note });
    return res.data;
  },
};

export default adminService;
