// truevision/services/ActivityService.js
//
// Thin axios wrapper around /api/activity/* endpoints. Matches the style of
// VideoService / ChatService — JWT attached via interceptor; every method
// returns the response body or `{ success: false, message }` on failure.

import axios from 'axios';
import { API_URL } from './config';
import { attachSessionGuard } from './sessionGuard';

const api = axios.create({
  baseURL: `${API_URL}/activity`,
  timeout: 15000,
});

attachSessionGuard(api);

const wrap = async (label, fn) => {
  try { return await fn(); }
  catch (e) {
    return { success: false, message: e.response?.data?.message || e.message || `${label} failed` };
  }
};

const activityService = {
  // ── Viewed Profiles ───────────────────────────────────────────────────────
  getViewedProfiles: (page = 1, limit = 20) =>
    wrap('viewed-profiles', async () => (await api.get('/viewed-profiles', { params: { page, limit } })).data),

  recordProfileView: (profileId) =>
    wrap('record-profile-view', async () => (await api.post('/viewed-profiles', { profileId })).data),

  deleteProfileView: (profileId) =>
    wrap('delete-profile-view', async () => (await api.delete(`/viewed-profiles/${profileId}`)).data),

  clearProfileViews: () =>
    wrap('clear-profile-views', async () => (await api.delete('/viewed-profiles')).data),

  // ── Shared Videos ─────────────────────────────────────────────────────────
  getSharedVideos: (page = 1, limit = 20) =>
    wrap('shared-videos', async () => (await api.get('/shared-videos', { params: { page, limit } })).data),

  /** Optional explicit record — note that the backend's POST /api/videos/:id/share
   *  already auto-records via piggyback. Use this only if you need a custom
   *  platform label without hitting the video controller. */
  recordShare: (videoId, platform = 'system_share') =>
    wrap('record-share', async () => (await api.post('/shared-videos', { videoId, platform })).data),

  deleteShare: (id) =>
    wrap('delete-share', async () => (await api.delete(`/shared-videos/${id}`)).data),

  clearShares: () =>
    wrap('clear-shares', async () => (await api.delete('/shared-videos')).data),

  // ── Search History ────────────────────────────────────────────────────────
  getSearchHistory: (limit = 30) =>
    wrap('search-history', async () => (await api.get('/search-history', { params: { limit } })).data),

  recordSearch: (query) =>
    wrap('record-search', async () => (await api.post('/search-history', { query })).data),

  deleteSearch: (id) =>
    wrap('delete-search', async () => (await api.delete(`/search-history/${id}`)).data),

  clearSearches: () =>
    wrap('clear-searches', async () => (await api.delete('/search-history')).data),

  // ── Comments History ──────────────────────────────────────────────────────
  /** Comments the current user has posted, newest first. Each item carries a
   *  lightweight `video` snapshot (or null if the video was deleted). */
  getMyComments: (page = 1, limit = 20) =>
    wrap('my-comments', async () => (await api.get('/comments', { params: { page, limit } })).data),

  // ── Clear everything ──────────────────────────────────────────────────────
  clearAll: () =>
    wrap('clear-all', async () => (await api.delete('/all')).data),
};

export default activityService;
