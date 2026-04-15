// truevision/services/VideoService.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://192.168.1.127:5000/api/videos';

// ── Axios instance ────────────────────────────────────────────────────────────
// Regular API calls: 30 s timeout
const api = axios.create({ baseURL: BASE_URL, timeout: 30000 });

// Attach JWT token to every request
const attachToken = async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
};
api.interceptors.request.use(attachToken);

// ─────────────────────────────────────────────────────────────────────────────
const videoService = {

  // ── FEED ────────────────────────────────────────────────────────────────────
  /** sort: 'new' | 'trending' | 'random' */
  getFeed: async (page = 1, limit = 10, sort = 'new', category = '') => {
    try {
      const params = { page, limit, sort };
      if (category && category !== 'all') params.category = category;
      const res = await api.get('/feed', { params });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // ── SEARCH ──────────────────────────────────────────────────────────────────
  searchVideos: async (q, page = 1, limit = 10, category = '') => {
    try {
      const params = { q, page, limit };
      if (category && category !== 'all') params.category = category;
      const res = await api.get('/search', { params });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // ── SINGLE VIDEO ─────────────────────────────────────────────────────────────
  getVideoById: async (id) => {
    try {
      const res = await api.get(`/${id}`);
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // ── USER VIDEOS ──────────────────────────────────────────────────────────────
  getUserVideos: async (userId, page = 1, limit = 12) => {
    try {
      const res = await api.get(`/user/${userId}`, { params: { page, limit } });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // ── UPLOAD ───────────────────────────────────────────────────────────────────
  /**
   * Direct Cloudinary signed upload — avoids double network transfer.
   * Flow: get signature from server → upload directly to Cloudinary → save record on server.
   *
   * Progress stages:
   *   0-94  uploading directly to Cloudinary
   *   95    saving video record on server
   *   100   done (set by caller on success)
   *
   * @param {string}   videoUri    Local file URI from ImagePicker
   * @param {object}   metadata    { title, description, song, tags, category, visibility, allowDownload }
   * @param {function} onProgress  (percent: number) => void
   */
  uploadVideo: async (videoUri, metadata, onProgress) => {
    const report = (pct) => { if (onProgress) onProgress(pct); };

    // ── Step 1: get signed upload params from our server ───────────────────────
    let sigData;
    try {
      const sigRes = await api.post('/upload-signature', {
        title:       metadata.title,
        description: metadata.description || '',
        tags:        metadata.tags        || '',
      });
      if (!sigRes.data?.success) {
        return { success: false, message: `[Auth] ${sigRes.data?.message || 'Server rejected the upload request'}` };
      }
      sigData = sigRes.data;
    } catch (e) {
      console.error('[Upload Step 1 Error]', e.message, e.response?.data);
      if (e.code === 'ECONNREFUSED' || e.message?.includes('Network Error')) {
        return { success: false, message: '[Connection] Cannot reach server. Make sure the backend is running and your phone is on the same Wi-Fi.' };
      }
      if (e.response?.status === 401) {
        return { success: false, message: '[Auth] Session expired. Please log out and log in again.' };
      }
      return { success: false, message: `[Auth] ${e.response?.data?.message || e.message || 'Could not start upload'}` };
    }

    const { signature, timestamp, folder, api_key, cloud_name } = sigData;

    // ── Step 2: upload directly to Cloudinary via native XMLHttpRequest ────────
    // React Native's XHR uses the device's native HTTP stack — handles large
    // video files reliably and provides real upload progress events.
    const mimeType      = metadata.mimeType || 'video/mp4';
    const ext           = mimeType.split('/')[1] || 'mp4';
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`;

    let cl;
    try {
      cl = await new Promise((resolve, reject) => {
        const formData = new FormData();
        // React Native handles { uri, type, name } as a real file read — not a plain object
        formData.append('file',      { uri: videoUri, type: mimeType, name: `upload.${ext}` });
        formData.append('api_key',   api_key);
        formData.append('timestamp', String(timestamp));
        formData.append('signature', signature);
        formData.append('folder',    folder);

        const xhr = new XMLHttpRequest();

        // Real upload progress
        xhr.upload.onprogress = (e) => {
          if (e.total > 0) {
            const pct = Math.min(Math.round((e.loaded / e.total) * 100), 94);
            report(pct);
          }
        };

        xhr.onload = () => {
          let body;
          try { body = JSON.parse(xhr.responseText); } catch (_) {
            return reject(new Error('Unreadable response from Cloudinary'));
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(body);
          } else {
            reject(new Error(body?.error?.message || `HTTP ${xhr.status}`));
          }
        };

        xhr.onerror   = () => reject(new Error('Network request failed — check your internet connection'));
        xhr.ontimeout = () => reject(new Error('Upload timed out — try a shorter or smaller video'));

        xhr.timeout = 600000; // 10 min
        xhr.open('POST', cloudinaryUrl);
        xhr.send(formData);
      });

      if (!cl?.public_id) {
        return { success: false, message: '[Cloudinary] Upload finished but no video ID returned. Try again.' };
      }
    } catch (e) {
      console.error('[Upload Step 2 Error]', e.message);
      return { success: false, message: `[Cloudinary] ${e.message || 'Failed to upload video'}` };
    }

    report(95);

    // ── Step 3: save video record on our server ────────────────────────────────
    try {
      const { mimeType: _m, ...cleanMeta } = metadata; // strip internal fields
      const saveRes = await api.post('/create', {
        publicId:  cl.public_id,
        secureUrl: cl.secure_url,
        duration:  cl.duration  || 0,
        bytes:     cl.bytes     || 0,
        format:    cl.format    || '',
        width:     cl.width     || 0,
        height:    cl.height    || 0,
        ...cleanMeta,
      });
      return saveRes.data;
    } catch (e) {
      console.error('[Upload Step 3 Error]', e.message, e.response?.data);
      // Video IS on Cloudinary already — tell the user so they know it partially succeeded
      return {
        success: false,
        message: `[Save] Video uploaded to cloud but could not save to database: ${e.response?.data?.message || e.message || 'Server error'}. Contact support with ID: ${cl.public_id}`,
      };
    }
  },

  // ── UPDATE ───────────────────────────────────────────────────────────────────
  updateVideo: async (id, data) => {
    try {
      const res = await api.put(`/${id}`, data);
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // ── DELETE ───────────────────────────────────────────────────────────────────
  deleteVideo: async (id) => {
    try {
      const res = await api.delete(`/${id}`);
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // ── SOCIAL ACTIONS ───────────────────────────────────────────────────────────
  toggleLike:         async (id) => { try { return (await api.post(`/${id}/like`)).data;          } catch(e) { return { success: false }; } },
  toggleSave:         async (id) => { try { return (await api.post(`/${id}/save`)).data;          } catch(e) { return { success: false }; } },
  toggleRepost:       async (id) => { try { return (await api.post(`/${id}/repost`)).data;        } catch(e) { return { success: false }; } },
  toggleFavorite:     async (id) => { try { return (await api.post(`/${id}/favorite`)).data;      } catch(e) { return { success: false }; } },
  markNotInterested:  async (id) => { try { return (await api.post(`/${id}/not-interested`)).data;} catch(e) { return { success: false }; } },
  recordView:  async (id, watchTime = 0) => { try { return (await api.post(`/${id}/view`, { watchTime })).data; } catch(e) { return { success: false }; } },
  shareVideo:  async (id)  => { try { return (await api.post(`/${id}/share`)).data;               } catch(e) { return { success: false }; } },
  downloadVideo: async (id)=> { try { return (await api.post(`/${id}/download`)).data;            } catch(e) { return { success: false }; } },
  reportVideo: async (id, reason, description = '') => {
    try { return (await api.post(`/${id}/report`, { reason, description })).data; }
    catch(e) { return { success: false }; }
  },

  // ── COLLECTIONS ──────────────────────────────────────────────────────────────
  getSavedVideos:    async (page = 1, limit = 12) => { try { return (await api.get('/saved',     { params: { page, limit } })).data; } catch(e) { return { success: false, videos: [] }; } },
  getLikedVideos:    async (page = 1, limit = 12) => { try { return (await api.get('/liked',     { params: { page, limit } })).data; } catch(e) { return { success: false, videos: [] }; } },
  getFavoriteVideos: async (page = 1, limit = 12) => { try { return (await api.get('/favorites', { params: { page, limit } })).data; } catch(e) { return { success: false, videos: [] }; } },

  // ── COMMENTS ─────────────────────────────────────────────────────────────────
  getComments:       async (videoId, page = 1, sort = 'new') => { try { return (await api.get(`/${videoId}/comments`, { params: { page, sort } })).data; } catch(e) { return { success: false, comments: [] }; } },
  addComment:        async (videoId, text)  => { try { return (await api.post(`/${videoId}/comments`, { text })).data;  } catch(e) { return { success: false }; } },
  deleteComment:     async (videoId, cid)   => { try { return (await api.delete(`/${videoId}/comments/${cid}`)).data;   } catch(e) { return { success: false }; } },
  toggleCommentLike: async (videoId, cid)   => { try { return (await api.post(`/${videoId}/comments/${cid}/like`)).data;} catch(e) { return { success: false }; } },
  addReply:          async (videoId, cid, text) => { try { return (await api.post(`/${videoId}/comments/${cid}/reply`, { text })).data; } catch(e) { return { success: false }; } },
};

export default videoService;
