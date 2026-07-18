// truevision/utils/reloadApp.js
//
// Reload the JS bundle. Needed when the RTL/LTR layout direction changes:
// React Native only re-lays-out the tree for I18nManager.forceRTL after a
// fresh start, so a cross-direction language switch must reload.
//
// Resolution order:
//   1. expo-updates reloadAsync()  — the correct path for standalone builds.
//      (Optional dep; install `expo-updates` to enable in production.)
//   2. DevSettings.reload()        — works in Expo Go / dev client.
// Both are wrapped so a missing module never throws into the caller.

import { DevSettings, NativeModules } from 'react-native';

export async function reloadApp() {
  // 1. expo-updates (production-grade OTA reload).
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    const Updates = require('expo-updates');
    if (Updates?.reloadAsync) {
      await Updates.reloadAsync();
      return true;
    }
  } catch (_) {
    // expo-updates not installed — fall through.
  }

  // 2. DevSettings (dev / Expo Go).
  try {
    if (DevSettings?.reload) {
      DevSettings.reload();
      return true;
    }
  } catch (_) { /* not available */ }

  // 3. Last-ditch native bridge.
  try {
    NativeModules?.DevSettings?.reload?.();
    return true;
  } catch (_) { /* nothing else to try */ }

  return false;
}
