// truevision/services/UserService.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

const BASE_URL = `${API_URL}/users`;

const api = axios.create({ baseURL: BASE_URL, timeout: 30000 });

// Attach JWT to every request automatically
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
};

export default userService;
