// truevision/services/pushRegistration.js
//
// Register this device's Expo push token with the backend so we can push
// chat notifications when the app is backgrounded or killed.
//
// Two entry points:
//   • `registerForPushNotifications()` — called on login / mount. Asks the
//     OS for permission, gets the ExponentPushToken, sends it to /users/push-token.
//   • `unregisterPushNotifications(token)` — called on logout so a shared
//     device doesn't page the previous account.
//
// ── FEATURE-FLAGGED ───────────────────────────────────────────────────────────
// Every entry point below is gated on `NotificationConfig.enabled`
// (see constants/notifications.js). While push is disabled (development / Expo
// Go) each helper is a safe no-op and `expo-notifications` is NEVER required —
// which is what actually silences the "removed from Expo Go" startup error,
// since that warning fires the moment the module loads inside Expo Go.
//
// To re-enable for a dev/prod build: flip ENABLE_PUSH_NOTIFICATIONS → true in
// constants/notifications.js. No change is needed in this file.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import chatService from './ChatService';
import { NotificationConfig } from '../constants/notifications';

// ── Lazy native-module loader ─────────────────────────────────────────────────
// We intentionally do NOT `require('expo-notifications')` at module top level.
// Loading that module inside Expo Go is what prints the red "remote push was
// removed from Expo Go" banner. By requiring it only from within the guarded
// functions below — which return early when push is disabled — the module is
// never touched during development, so the error can never appear.
let Notifications = null;
let Device        = null;
let modulesLoaded = false;

const loadNativeModules = () => {
  if (modulesLoaded) return;
  modulesLoaded = true;
  try {
    // eslint-disable-next-line import/no-unresolved
    Notifications = require('expo-notifications');
  } catch (_) { /* optional dep — stays null, helpers no-op */ }
  try {
    // eslint-disable-next-line import/no-unresolved
    Device = require('expo-device');
  } catch (_) { /* optional */ }
};

/** Whether this runtime can register a remote push token (dev build / prod). */
export const canUseRemotePush = () => NotificationConfig.enabled;

// Cache the last registered token so we don't re-hit the backend on every
// AuthContext render.
let lastRegisteredToken = null;

/** Configure the default handler + Android channels. Idempotent. */
const configureNotifications = () => {
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  true,
      // New iOS 14+ keys — same signal, richer control.
      shouldShowBanner: true,
      shouldShowList:   true,
    }),
  });

  if (Platform.OS === 'android') {
    // Android REQUIRES a channel for high-importance heads-up notifications.
    Notifications.setNotificationChannelAsync('chat-messages', {
      name:            'Chat Messages',
      importance:      Notifications.AndroidImportance.MAX,
      vibrationPattern:[0, 250, 250, 250],
      lightColor:      '#3B82F6',
      sound:           'default',
      showBadge:       true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }).catch(() => {});

    // Social channel — likes, comments, follows, mentions, app updates.
    // The backend targets channelId 'social' for those pushes; without the
    // channel existing on-device Android downgrades or drops them.
    Notifications.setNotificationChannelAsync('social', {
      name:            'Social Activity',
      importance:      Notifications.AndroidImportance.HIGH,
      vibrationPattern:[0, 200],
      lightColor:      '#3B82F6',
      sound:           'default',
      showBadge:       true,
    }).catch(() => {});
  }
};

/** Ask permission, fetch the Expo push token, POST to backend. Returns the token or null. */
export const registerForPushNotifications = async () => {
  // Feature flag OFF (development / Expo Go): bypass registration entirely.
  // No permission dialog, no channels, no token, no backend call — and
  // crucially, expo-notifications is never loaded. Flip
  // ENABLE_PUSH_NOTIFICATIONS in constants/notifications.js to enable.
  if (!NotificationConfig.enabled) return null;

  loadNativeModules();
  if (!Notifications) {
    console.warn('[push] expo-notifications not installed — skipping.');
    return null;
  }

  // Simulators/emulators can't get push tokens on iOS — save the network trip.
  if (Device && !Device.isDevice) return null;

  configureNotifications();

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      console.log('[push] User denied notifications permission');
      return null;
    }

    // getExpoPushTokenAsync needs the EAS projectId in a bare/dev-build context;
    // pass it explicitly so token generation doesn't fail on some setups.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenData?.data;
    if (!token) return null;

    if (token === lastRegisteredToken) return token; // already synced this session
    const res = await chatService.registerPushToken(token, 'expo');
    if (res?.success) lastRegisteredToken = token;
    return token;
  } catch (err) {
    console.warn('[push] register failed:', err.message);
    return null;
  }
};

/** Unregister on logout so a shared device doesn't page a signed-out user. */
export const unregisterPushNotifications = async () => {
  if (!NotificationConfig.enabled) return;
  loadNativeModules();
  if (!Notifications || !lastRegisteredToken) return;
  try {
    await chatService.unregisterPushToken(lastRegisteredToken, 'expo');
  } catch (_) { /* best-effort */ }
  lastRegisteredToken = null;
};

/** Subscribe to tapped-notification events. Returns an unsubscribe fn.
 *  The `handler` receives the notification response.data payload — which
 *  the backend fills with { chatId, senderId, messageId, type } for taps
 *  to deep-link into the correct chat. */
export const onNotificationTap = (handler) => {
  if (!NotificationConfig.enabled) return () => {};
  loadNativeModules();
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handler(response?.notification?.request?.content?.data || {});
  });
  return () => sub.remove();
};

/** Subscribe to foreground-received events (already-focused screen). */
export const onNotificationReceived = (handler) => {
  if (!NotificationConfig.enabled) return () => {};
  loadNativeModules();
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationReceivedListener((notification) => {
    handler(notification?.request?.content?.data || {});
  });
  return () => sub.remove();
};
