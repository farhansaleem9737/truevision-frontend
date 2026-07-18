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
import axios from 'axios';
import { API_URL } from './config';

// Storage keys — the ACCESS token keeps the historical 'authToken' key so every
// existing reader (SocketService, request interceptor, etc.) keeps working; the
// refresh token lives beside it.
const ACCESS_KEY  = 'authToken';
const REFRESH_KEY = 'refreshToken';

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

// Only an EXPIRED access token is refreshable. TOKEN_INVALID / USER_NOT_FOUND /
// TOKEN_NOT_ACTIVE mean the credential is deliberately dead → go straight to
// logout (no point trying to refresh; the refresh family is revoked too).
const isRefreshable = (status, body) => status === 401 && body?.code === 'TOKEN_EXPIRED';

// ── Single-flight refresh ────────────────────────────────────────────────────
// A burst of 401s (parallel requests) must trigger exactly ONE /auth/refresh;
// all of them await the same promise, then retry with the new token. Uses a
// BARE fetch (no interceptors) so it can never recurse into itself.
let refreshPromise = null;

const doRefresh = async () => {
  const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
  if (!refreshToken) { const e = new Error('NO_REFRESH_TOKEN'); e.refreshFailed = true; throw e; }

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  let data = null;
  try { data = await res.json(); } catch (_) { /* non-JSON */ }

  const newAccess  = data?.data?.token;
  const newRefresh = data?.data?.refreshToken;
  if (!res.ok || !data?.success || !newAccess) {
    const e = new Error(data?.code || `REFRESH_${res.status}`);
    e.refreshFailed = true;
    throw e;
  }

  const pairs = [[ACCESS_KEY, newAccess]];
  if (newRefresh) pairs.push([REFRESH_KEY, newRefresh]);
  await AsyncStorage.multiSet(pairs);
  return newAccess;
};

const refreshOnce = () => {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

// Purge tokens + broadcast a single logout event. Exposed so the socket layer
// can trigger the same graceful logout on sessionRevoked / reconnect_failed.
export const invalidateSession = async (payload = {}) => {
  try { await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, 'userData']); } catch (_) {}
  broadcastInvalidation({
    code:   payload.code   || 'TOKEN_INVALID',
    reason: payload.reason || 'Session ended',
  });
};

/** Proactively refresh the access token (e.g. on app resume). Returns the new
 *  token, or null if there's nothing to refresh / it failed. Never throws. */
export const refreshSession = async () => {
  try { return await refreshOnce(); }
  catch (_) { return null; }
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

  const original = error?.config || {};

  // 1) Access token expired → single-flight refresh, then retry ONCE. The
  //    __isRefreshRetry guard prevents any possibility of a refresh loop.
  if (isRefreshable(status, body) && !original.__isRefreshRetry) {
    try {
      const newToken = await refreshOnce();
      original.__isRefreshRetry = true;
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newToken}`;
      // Retry via bare axios so this instance's interceptors don't re-run
      // (the guard above would stop a loop anyway).
      return axios(original);
    } catch (_) {
      // Refresh failed (no refresh token / rotated-reuse / expired) → the
      // session is genuinely over. Fall through to graceful logout.
      await invalidateSession({ code: body?.code || 'TOKEN_EXPIRED', reason: 'Session expired' });
      return Promise.reject(error);
    }
  }

  // 2) Non-refreshable auth failure (invalid / revoked / user-gone) → logout.
  if (isAuthFailure(status, body)) {
    await invalidateSession({ code: body?.code, reason: body?.message || 'Session expired' });
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
