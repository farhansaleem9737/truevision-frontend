// truevision/constants/notifications.js
//
// ── CENTRALIZED PUSH-NOTIFICATION FEATURE FLAG ───────────────────────────────
//
// Remote push notifications are DISABLED during development because Expo Go
// (SDK 53+) removed remote-push support — leaving it on logs a red
// "Android Push notifications ... was removed from Expo Go" error on every
// launch. We are not building a Development/Production binary yet, and
// notifications are not the current priority.
//
// The ENTIRE notification architecture is preserved and untouched:
//   • services/pushRegistration.js   (register / unregister / listeners)
//   • ChatService push-token endpoints
//   • backend /users/push-token routes + models
//   • Android notification channels + handlers
// Nothing is deleted. Initialization is simply *bypassed* while this flag is off.
//
//   ┌────────────────────────────────────────────────────────────────────────┐
//   │  TO RE-ENABLE PUSH (dev build / production build):                       │
//   │                                                                          │
//   │      ENABLE_PUSH_NOTIFICATIONS = true;   ← flip this one line. Done.     │
//   │                                                                          │
//   └────────────────────────────────────────────────────────────────────────┘
//
// No other code change is required. Every notification call site routes
// through `NotificationConfig.enabled` below.

import Constants from 'expo-constants';

// ── THE MASTER SWITCH ────────────────────────────────────────────────────────
// Development default: false (push off). Set to `true` in a Development Build
// or Production Build to enable push notifications app-wide.
export const ENABLE_PUSH_NOTIFICATIONS = false;

// ── Expo Go detection (SDK 53-safe) ──────────────────────────────────────────
// Remote push was removed from Expo Go in SDK 53. `executionEnvironment ===
// 'storeClient'` is the canonical Expo Go signal; `appOwnership === 'expo'` is
// the legacy fallback for older runtimes. Either way = "we're inside Expo Go".
export const IS_EXPO_GO =
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

// ── Resolved state — the SINGLE source of truth every caller checks ──────────
// Push initializes only when explicitly enabled AND not inside Expo Go. The
// Expo Go guard is an extra safety net: even if the flag is left `true`, Expo
// Go never registers, so the "removed from Expo Go" error can never re-appear.
export const NotificationConfig = {
  /** True only when push notifications should actually initialize. */
  enabled: ENABLE_PUSH_NOTIFICATIONS && !IS_EXPO_GO,
  /** True when running inside Expo Go (remote push unavailable). */
  isExpoGo: IS_EXPO_GO,
  /** The raw developer flag, independent of the Expo Go override. */
  flag: ENABLE_PUSH_NOTIFICATIONS,
};

export default NotificationConfig;
