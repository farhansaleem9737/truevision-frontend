// truevision/services/SecurityService.js
//
// Client for /api/security/* and the 2FA halves of /api/auth/*.
// Same conventions as the other services: guarded axios instance
// (Bearer attach + 401 purge via sessionGuard), never throws — every
// method resolves { success, ... }.

import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_URL } from './config';
import { attachSessionGuard } from './sessionGuard';

let Device = null;
try { Device = require('expo-device'); } catch (_) { /* optional */ }

// Same device-identity headers as AuthServices — 2fa-verify creates the
// LoginSession row, so it needs to know the device too.
const deviceHeaders = {
  'x-device-name': Device?.modelName || Device?.deviceName || `${Platform.OS} device`,
  'x-device-os':   `${Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS} ${Device?.osVersion || Platform.Version || ''}`.trim(),
  'x-app-version': Constants?.expoConfig?.version || '1.0.0',
};

const api = axios.create({ baseURL: `${API_URL}/security`, timeout: 20000, headers: deviceHeaders });
attachSessionGuard(api);

// 2FA login endpoints live under /api/auth and are authenticated by the
// pendingToken in the body — NOT by the Bearer header — so a plain
// instance is fine (the guard would just find no token).
const authApi = axios.create({ baseURL: `${API_URL}/auth`, timeout: 20000, headers: deviceHeaders });

const wrap = async (fn) => {
  try { return (await fn()).data; }
  catch (e) {
    return {
      success: false,
      message: e.response?.data?.message || e.message || 'Network error',
      code:    e.response?.data?.code,
      status:  e.response?.status,
    };
  }
};

const securityService = {
  // ── Snapshot ──────────────────────────────────────────────────────────
  getSettings: () => wrap(() => api.get('/settings')),

  // ── Change password ───────────────────────────────────────────────────
  changePassword: (currentPassword, newPassword) =>
    wrap(() => api.patch('/password', { currentPassword, newPassword })),

  // ── Two-factor authentication ─────────────────────────────────────────
  /** purpose: 'enable-2fa' | 'disable-2fa' */
  sendTwoFactorOtp: (purpose) => wrap(() => api.post('/send-email-otp', { purpose })),
  setTwoFactor:     (enabled, otp) => wrap(() => api.patch('/2fa', { enabled, otp })),

  // 2FA at sign-in (pendingToken from the login response)
  verifyLoginOtp: (pendingToken, otp) =>
    wrap(() => authApi.post('/2fa-verify', { pendingToken, otp })),
  resendLoginOtp: (pendingToken) =>
    wrap(() => authApi.post('/2fa-resend', { pendingToken })),

  // ── Phone verification ────────────────────────────────────────────────
  sendPhoneOtp: (countryCode, phoneNumber) =>
    wrap(() => api.post('/send-phone-otp', { countryCode, phoneNumber })),
  verifyPhone: (otp)  => wrap(() => api.post('/verify-phone', { otp })),
  removePhone: ()     => wrap(() => api.delete('/phone')),

  // ── Sessions ──────────────────────────────────────────────────────────
  getLoginActivity: (page = 1, limit = 20) =>
    wrap(() => api.get('/login-activity', { params: { page, limit } })),
  deleteSession: (id) => wrap(() => api.delete(`/sessions/${id}`)),
  logoutAll: (keepCurrent = false) =>
    wrap(() => api.delete('/logout-all', { data: { keepCurrent } })),
};

export default securityService;
