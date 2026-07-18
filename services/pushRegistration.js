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
// Optional dep: expo-notifications. If not installed, every helper is a
// safe no-op so the app keeps working without notifications.

import { Platform } from 'react-native';
import chatService from './ChatService';

let Notifications = null;
let Device        = null;
try {
  // eslint-disable-next-line import/no-unresolved
  Notifications = require('expo-notifications');
} catch (_) { /* optional */ }
try {
  // eslint-disable-next-line import/no-unresolved
  Device = require('expo-device');
} catch (_) { /* optional */ }

// Cache the last registered token so we don't re-hit the backend on every
// AuthContext render.
let lastRegisteredToken = null;

/** Configure the default handler + Android channel. Idempotent. */
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

    const tokenData = await Notifications.getExpoPushTokenAsync();
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
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handler(response?.notification?.request?.content?.data || {});
  });
  return () => sub.remove();
};

/** Subscribe to foreground-received events (already-focused screen). */
export const onNotificationReceived = (handler) => {
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationReceivedListener((notification) => {
    handler(notification?.request?.content?.data || {});
  });
  return () => sub.remove();
};
