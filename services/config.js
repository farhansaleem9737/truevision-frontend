// truevision/services/config.js
//
// Dynamic server URL detection.
//
// In development: automatically uses the same IP that Expo's dev server runs on
// (extracted from Constants.debuggerHost), so you NEVER need to update IPs manually.
//
// In production: uses the PROD_API_URL constant below.

import Constants from 'expo-constants';

// ── Production URL (update this when you deploy) ────────────────────────────
const PROD_API_URL = 'https://api.truevision.app';

// ── Backend port (must match Backend/.env PORT) ─────────────────────────────
const SERVER_PORT = 5000;

// ── Auto-detect dev server IP from Expo ─────────────────────────────────────
function getDevServerUrl() {
  // Constants.debuggerHost is set by Expo dev server, e.g. "192.168.1.127:8081"
  const debuggerHost = Constants.debuggerHost ?? Constants.expoConfig?.hostUri ?? '';
  const ip = debuggerHost.split(':')[0];

  if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
    return `http://${ip}:${SERVER_PORT}`;
  }

  // Fallback: try localhost (emulator)
  return `http://localhost:${SERVER_PORT}`;
}

// ── Determine if we're in dev or production ─────────────────────────────────
const isDev = __DEV__;

export const SERVER_URL = isDev ? getDevServerUrl() : PROD_API_URL;
export const API_URL    = `${SERVER_URL}/api`;

// Log once so you can verify in the console
if (isDev) {
  console.log(`[Config] Server URL: ${SERVER_URL}`);
}
