// truevision/services/sessionGuard.js
//
// Single source of truth for JWT lifecycle across every axios instance in the
// app. Fixes the "zombie signed-in" bug where a stale token in AsyncStorage
// would keep failing every mutation with "Invalid or expired token" and the
// user had no path back to a fresh session.
//
// Usage:
//   import { attachSessionGuard, onSessionInvalidated } from './sessionGuard';
//   const api = axios.create({ ... });
//   attachSessionGuard(api);           // request + response interceptors
//
//   // In AuthProvider:
//   const off = onSessionInvalidated(({ code, reason }) => {
//     clearAuthData(); // drops React state and AsyncStorage
//   });
//
// Design notes:
//   • Request interceptor reads authToken from AsyncStorage on every call —
//     no in-memory cache so a logout is picked up immediately.
//   • Response interceptor fires on 401 with backend-issued auth codes
//     (TOKEN_EXPIRED / TOKEN_INVALID / TOKEN_NOT_ACTIVE / USER_NOT_FOUND) or
//     the legacy "Not authorized" / "Invalid or expired token" messages so
//     older servers keep working.
//   • Invalidation is broadcast once — repeated 401s for the same reason
//     don't retrigger the logout flow (rate-limits log noise + UI churn).

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Dev-only debug logging (stripped in production by Metro) ────────────────
// Gated behind __DEV__ so live builds never see any of this. Keep the format
// terse — one line per request/response so the Metro console stays readable.
const DEBUG = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

const maskToken = (t) => {
  if (!t || typeof t !== 'string') return '(none)';
  if (t.length <= 12) return '***';
  return `${t.slice(0, 6)}…${t.slice(-4)} (len=${t.length})`;
};

const previewBody = (data) => {
  if (data == null) return undefined;
  if (typeof data === 'string') return data.length > 160 ? data.slice(0, 157) + '…' : data;
  if (typeof FormData !== 'undefined' && data instanceof FormData) return '[FormData]';
  try {
    const json = JSON.stringify(data);
    return json.length > 160 ? json.slice(0, 157) + '…' : json;
  } catch (_) { return '[unserialisable]'; }
};

// ── Tiny event bus (no external dep) ────────────────────────────────────────
const listeners = new Set();

/** Register a callback for session-invalidated events. Returns an unsubscribe fn. */
export const onSessionInvalidated = (cb) => {
  if (typeof cb !== 'function') return () => {};
  listeners.add(cb);
  return () => listeners.delete(cb);
};

let lastInvalidationAt = 0;
const INVALIDATION_COOLDOWN_MS = 3000;

const broadcastInvalidation = (payload) => {
  const now = Date.now();
  // Debounce: if we already fired within the cooldown, don't spam.
  if (now - lastInvalidationAt < INVALIDATION_COOLDOWN_MS) return;
  lastInvalidationAt = now;
  for (const cb of listeners) {
    try { cb(payload); } catch (_) { /* isolate failures */ }
  }
};

// ── Auth codes returned by Backend/middleware/Auth.js ───────────────────────
const AUTH_INVALIDATION_CODES = new Set([
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'TOKEN_NOT_ACTIVE',
  'USER_NOT_FOUND',
]);

// Legacy message strings from older backend deploys, kept for graceful
// migration until every environment ships the new coded response.
const LEGACY_AUTH_MESSAGES = [
  'invalid or expired token',
  'not authorized to access this route',
  'session ended',
];

const isAuthFailure = (status, body) => {
  if (status !== 401) return false;
  if (body?.code && AUTH_INVALIDATION_CODES.has(body.code)) return true;
  const msg = String(body?.message || '').toLowerCase();
  return LEGACY_AUTH_MESSAGES.some((needle) => msg.includes(needle));
};

// ── Request interceptor: attach the newest token every call ─────────────────
const requestInterceptor = async (config) => {
  let token = null;
  try {
    token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_) { /* AsyncStorage failure is non-fatal — request may still succeed for public routes */ }

  if (DEBUG) {
    const method = String(config.method || 'get').toUpperCase();
    const fullUrl = (config.baseURL || '') + (config.url || '');
    // Masked so the token itself never leaks into a bug report or a shared
    // Metro log. Body preview capped at 160 chars.
    console.log(
      `[api→] ${method} ${fullUrl}  Authorization=${token ? `Bearer ${maskToken(token)}` : '(none)'}  body=${previewBody(config.data) ?? '(none)'}`,
    );
  }
  return config;
};

// ── Response interceptor: on 401, purge storage + broadcast ─────────────────
const responseSuccessInterceptor = (response) => {
  if (DEBUG) {
    const method = String(response.config?.method || 'get').toUpperCase();
    const fullUrl = (response.config?.baseURL || '') + (response.config?.url || '');
    console.log(`[api←] ${method} ${fullUrl}  ${response.status}`);
  }
  return response;
};

const responseErrorInterceptor = async (error) => {
  const status = error?.response?.status;
  const body   = error?.response?.data;

  if (DEBUG) {
    const method = String(error?.config?.method || 'get').toUpperCase();
    const fullUrl = (error?.config?.baseURL || '') + (error?.config?.url || '');
    const bodyPreview = previewBody(body);
    console.warn(
      `[api✗] ${method} ${fullUrl}  ${status ?? '(network)'}  code=${body?.code || '-'}  msg=${body?.message || error?.message || '-'}  body=${bodyPreview ?? '(none)'}`,
    );
  }

  if (isAuthFailure(status, body)) {
    // Purge the bad token *before* broadcasting so any listener that reads
    // AsyncStorage sees a clean slate.
    try {
      await AsyncStorage.multiRemove(['authToken', 'userData']);
    } catch (_) { /* best-effort */ }

    broadcastInvalidation({
      code:   body?.code   || 'TOKEN_INVALID',
      reason: body?.message || 'Session expired',
      url:    error?.config?.url,
      method: error?.config?.method,
    });
  }

  return Promise.reject(error);
};

/** Attach both interceptors to an axios instance. Idempotent per-instance. */
export const attachSessionGuard = (axiosInstance) => {
  if (!axiosInstance || axiosInstance.__sessionGuardAttached) return axiosInstance;
  axiosInstance.interceptors.request.use(requestInterceptor);
  axiosInstance.interceptors.response.use(
    responseSuccessInterceptor,
    responseErrorInterceptor,
  );
  Object.defineProperty(axiosInstance, '__sessionGuardAttached', {
    value: true, writable: false, enumerable: false,
  });
  return axiosInstance;
};

/** True if a rejected axios error was an auth-failure 401. Callers can
 *  branch their UI (e.g. show "Please sign in again" vs "Try again"). */
export const isAuthError = (err) => isAuthFailure(err?.response?.status, err?.response?.data);
