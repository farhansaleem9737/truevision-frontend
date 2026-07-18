// truevision/services/UserService.js
import axios from 'axios';
import { API_URL } from './config';
import { attachSessionGuard } from './sessionGuard';

const BASE_URL = `${API_URL}/users`;

const api = axios.create({ baseURL: BASE_URL, timeout: 30000 });

attachSessionGuard(api);

// ─────────────────────────────────────────────────────────────────────────────
// Upload image directly to Cloudinary via native XMLHttpRequest.
// Returns a Promise that resolves with the Cloudinary response object.
// ─────────────────────────────────────────────────────────────────────────────
const uploadImageToCloudinary = (imageUri, mimeType, sigData, onProgress) =>
  new Promise((resolve, reject) => {
    // Derive file extension from mimeType (image/jpeg → jpg, image/png → png …)
    const ext      = mimeType?.split('/')?.[1]?.replace('jpeg', 'jpg') || 'jpg';
    const formData = new FormData();

    formData.append('file',      { uri: imageUri, type: mimeType || 'image/jpeg', name: `profile.${ext}` });
    formData.append('api_key',   sigData.api_key);
    formData.append('timestamp', String(sigData.timestamp));
    formData.append('signature', sigData.signature);
    formData.append('folder',    sigData.folder);
    if (sigData.overwrite) formData.append('overwrite', 'true');

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.total > 0 && onProgress) {
        onProgress(Math.min(Math.round((e.loaded / e.total) * 100), 99));
      }
    };

    xhr.onload = () => {
      let body;
      try { body = JSON.parse(xhr.responseText); } catch (_) {
        return reject(new Error('Unreadable response from Cloudinary'));
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve(body);
      } else {
        reject(new Error(body?.error?.message || `Upload failed (HTTP ${xhr.status})`));
      }
    };

    xhr.onerror   = () => reject(new Error('Network error — check your internet connection'));
    xhr.ontimeout = () => reject(new Error('Image upload timed out'));

    xhr.timeout = 60000; // 1 minute is plenty for a profile photo
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sigData.cloud_name}/image/upload`);
    xhr.send(formData);
  });

// ─────────────────────────────────────────────────────────────────────────────
const userService = {

  // ── Get current user's full profile ────────────────────────────────────────
  getMe: async () => {
    try {
      const res = await api.get('/me');
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // ── Update text fields (fullName, username, bio, country) ──────────────────
  updateProfile: async (data) => {
    try {
      const res = await api.put('/profile', data);
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // ── Full profile image upload flow ─────────────────────────────────────────
  // 1. Get signed params from our server
  // 2. Upload image directly to Cloudinary (with progress)
  // 3. Tell our server the final imageUrl + publicId
  //
  // onProgress: (0-100) => void
  uploadProfileImage: async (imageUri, mimeType, onProgress) => {
    try {
      // Step 1 — signature
      const sigRes = await api.get('/profile-image/signature');
      if (!sigRes.data?.success) {
        return { success: false, message: sigRes.data?.message || 'Could not start upload' };
      }

      // Step 2 — direct upload to Cloudinary
      let cloudResult;
      try {
        cloudResult = await uploadImageToCloudinary(imageUri, mimeType, sigRes.data, onProgress);
      } catch (uploadErr) {
        return { success: false, message: `[Cloudinary] ${uploadErr.message}` };
      }

      if (!cloudResult?.secure_url || !cloudResult?.public_id) {
        return { success: false, message: 'Cloudinary did not return an image URL' };
      }

      // Step 3 — save URL + publicId in our DB
      const saveRes = await api.post('/profile-image', {
        imageUrl: cloudResult.secure_url,
        publicId: cloudResult.public_id,
      });

      return saveRes.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Upload failed' };
    }
  },

  // ── Remove profile image ────────────────────────────────────────────────────
  removeProfileImage: async () => {
    try {
      const res = await api.delete('/profile-image');
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // ── Search users by name / username ─────────────────────────────────────────
  searchUsers: async (q) => {
    try {
      const res = await api.get('/search', { params: { q } });
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error', users: [] };
    }
  },

  // ── Update preferences (privacy / notifications / content / language) ──────
  updatePreferences: async (patch) => {
    try {
      const res = await api.put('/preferences', patch);
      return res.data;
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'Network error' };
    }
  },

  // ── Social graph (profiles / follows / requests / blocks) ──────────────────
  // These pass the backend error body through untouched so callers can branch
  // on `code` (e.g. FOLLOWERS_PRIVATE, ACCOUNT_PRIVATE) as well as `message`.

  // ── Public profile of any user ──────────────────────────────────────────────
  getUserProfile: async (userId) => {
    try {
      const res = await api.get(`/${userId}/profile`);
      return res.data;
    } catch (e) {
      return { success: false, message: 'Network error', ...(e.response?.data || {}) };
    }
  },

  // ── Follow / unfollow ────────────────────────────────────────────────────────
  // followUser resolves to { status: 'following' } for public accounts or
  // { status: 'requested' } when the target account is private.
  followUser: async (userId) => {
    try {
      const res = await api.post(`/${userId}/follow`);
      return res.data;
    } catch (e) {
      return { success: false, message: 'Network error', ...(e.response?.data || {}) };
    }
  },

  unfollowUser: async (userId) => {
    try {
      const res = await api.delete(`/${userId}/follow`);
      return res.data;
    } catch (e) {
      return { success: false, message: 'Network error', ...(e.response?.data || {}) };
    }
  },

  // ── Follow requests (private accounts) ──────────────────────────────────────
  getFollowRequests: async (page = 1, limit = 20) => {
    try {
      const res = await api.get('/follow-requests', { params: { page, limit } });
      return res.data;
    } catch (e) {
      return { success: false, message: 'Network error', ...(e.response?.data || {}) };
    }
  },

  acceptFollowRequest: async (userId) => {
    try {
      const res = await api.post(`/follow-requests/${userId}/accept`);
      return res.data;
    } catch (e) {
      return { success: false, message: 'Network error', ...(e.response?.data || {}) };
    }
  },

  declineFollowRequest: async (userId) => {
    try {
      const res = await api.post(`/follow-requests/${userId}/decline`);
      return res.data;
    } catch (e) {
      return { success: false, message: 'Network error', ...(e.response?.data || {}) };
    }
  },

  // ── Followers / following lists ─────────────────────────────────────────────
  // May fail with 403 { code: 'FOLLOWERS_PRIVATE' | 'ACCOUNT_PRIVATE' } — the
  // code is passed through so list screens can show the right empty state.
  getFollowers: async (userId, page = 1, limit = 30) => {
    try {
      const res = await api.get(`/${userId}/followers`, { params: { page, limit } });
      return res.data;
    } catch (e) {
      return { success: false, message: 'Network error', ...(e.response?.data || {}) };
    }
  },

  getFollowing: async (userId, page = 1, limit = 30) => {
    try {
      const res = await api.get(`/${userId}/following`, { params: { page, limit } });
      return res.data;
    } catch (e) {
      return { success: false, message: 'Network error', ...(e.response?.data || {}) };
    }
  },

  // ── Block / unblock ──────────────────────────────────────────────────────────
  blockUser: async (userId) => {
    try {
      const res = await api.post(`/${userId}/block`);
      return res.data;
    } catch (e) {
      return { success: false, message: 'Network error', ...(e.response?.data || {}) };
    }
  },

  unblockUser: async (userId) => {
    try {
      const res = await api.delete(`/${userId}/block`);
      return res.data;
    } catch (e) {
      return { success: false, message: 'Network error', ...(e.response?.data || {}) };
    }
  },

  getBlockedUsers: async ({ page = 1, limit = 30, q = '' } = {}) => {
    try {
      const params = { page, limit };
      if (q) params.q = q;
      const res = await api.get('/blocked', { params });
      return res.data;
    } catch (e) {
      return { success: false, message: 'Network error', ...(e.response?.data || {}) };
    }
  },
};

export default userService;
