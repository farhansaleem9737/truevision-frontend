//truevision/services/AuthServices.js
import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_URL as BASE_API } from './config';
import { attachSessionGuard } from './sessionGuard';

// expo-device is optional at require-time (matches pushRegistration.js
// pattern) — Platform gives a usable fallback if it's ever removed.
let Device = null;
try { Device = require('expo-device'); } catch (_) { /* optional */ }

const API_URL = `${BASE_API}/auth`;

// Device identity headers — read by Backend/services/sessionTracker at
// login to build the Security screen's "Login Activity" rows.
const deviceHeaders = {
  'x-device-name': Device?.modelName || Device?.deviceName || `${Platform.OS} device`,
  'x-device-os':   `${Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS} ${Device?.osVersion || Platform.Version || ''}`.trim(),
  'x-app-version': Constants?.expoConfig?.version || '1.0.0',
};

// Axios instance — attaches JWT automatically and reacts to 401 by purging
// stale credentials + broadcasting session:invalidated.
const api = axios.create({ baseURL: API_URL, timeout: 10000, headers: deviceHeaders });
attachSessionGuard(api);

const authService = {
  register: async (userData) => {
    try {
      const response = await api.post('/register', userData);
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  login: async (emailOrUsername, password) => {
    try {
      const response = await api.post('/login', { emailOrUsername, password });
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  // Sign in / sign up with Google. The screen runs the OAuth flow with
  // expo-auth-session, gets an id_token from Google, and hands it here.
  // The backend verifies the token + returns the same { token, user }
  // envelope as /login.
  googleSignIn: async (idToken) => {
    try {
      const response = await api.post('/google', { idToken });
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  // Server-side sign-out: adds this token to the Redis revocation list and
  // closes the LoginSession row (so the device stops showing as active in
  // Security → Login Activity). Must be called while the Bearer header is
  // still attached — i.e. BEFORE clearing AsyncStorage.
  // Pass the refresh token so the server revokes its whole family (otherwise a
  // leaked refresh token could keep minting access after logout).
  logout: async (refreshToken) => {
    try {
      const response = await api.post('/logout', refreshToken ? { refreshToken } : {});
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  verifyEmail: async (email, otp) => {
    try {
      const response = await api.post('/verify-email', { email, otp });
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  resendOTP: async (email) => {
    try {
      const response = await api.post('/resend-otp', { email });
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  forgotPassword: async (email) => {
    try {
      const response = await api.post('/forgot-password', { email });
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  resetPassword: async (email, otp, newPassword) => {
    try {
      const response = await api.post('/reset-password', { email, otp, newPassword });
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  getProfile: async (token) => {
    try {
      const response = await api.get('/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  // Get signed params to upload a profile image directly to Cloudinary
  getProfileImageSignature: async () => {
    try {
      const response = await api.get('/profile-image-signature');
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  // Update profile fields + optional profileImageUrl
  updateProfile: async (data) => {
    try {
      const response = await api.put('/profile', data);
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },
};

export default authService;
