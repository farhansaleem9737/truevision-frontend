//truevision/services/AuthServices.js
import axios from 'axios';

// Update this with your backend URL
const API_URL = "http://192.168.1.127:5000/api/auth" ;
// For Android Emulator use: http://10.0.2.2:5000/api/auth
// For physical device use your computer's IP: http://192.168.x.x:5000/api/auth

const authService = {
  register: async (userData) => {
    try {
      const response = await axios.post(`${API_URL}/register`, userData);
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  login: async (emailOrUsername, password) => {
    try {
      const response = await axios.post(`${API_URL}/login`, {
        emailOrUsername,
        password
      });
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  verifyEmail: async (email, otp) => {
    try {
      const response = await axios.post(`${API_URL}/verify-email`, {
        email,
        otp
      });
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  resendOTP: async (email) => {
    try {
      const response = await axios.post(`${API_URL}/resend-otp`, { email });
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  forgotPassword: async (email) => {
    try {
      const response = await axios.post(`${API_URL}/forgot-password`, { email });
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  resetPassword: async (email, otp, newPassword) => {
    try {
      const response = await axios.post(`${API_URL}/reset-password`, {
        email,
        otp,
        newPassword
      });
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  },

  getProfile: async (token) => {
    try {
      const response = await axios.get(`${API_URL}/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      return error.response?.data || { success: false, message: 'Network error' };
    }
  }
};

export default authService;