//truevision/services/AuthServices.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL as BASE_API } from './config';

const API_URL = `${BASE_API}/auth`;

// Axios instance — attaches JWT automatically
const api = axios.create({ baseURL: API_URL, timeout: 10000 });
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
