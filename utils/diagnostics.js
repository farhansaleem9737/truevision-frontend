// truevision/utils/diagnostics.js
//
// Collects the device / app / OS / network context that Contact and Report
// forms attach automatically so support can reproduce issues. Everything here
// is best-effort and degrades gracefully — a missing field is just an empty
// string, never a crash.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import i18n from '../i18n';

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
const BUILD_NUMBER = String(
  Constants.expoConfig?.android?.versionCode ??
  Constants.expoConfig?.ios?.buildNumber ??
  '1',
);

// Human-readable device label. expo-device isn't a dependency, so we compose
// from what expo-constants + Platform expose (honest about what we know).
const deviceLabel = () => {
  const name = Constants.deviceName || '';
  const model = Constants.platform?.android?.model || Constants.platform?.ios?.model || '';
  return [name, model].filter(Boolean).join(' · ') || `${Platform.OS} device`;
};

/**
 * @param {object} net  the object returned by useNetworkStatus()
 * @returns diagnostics object matching the backend SupportTicket.diagnostics
 */
export function collectDiagnostics(net = {}) {
  const network = net.isConnected === false
    ? 'none'
    : net.isWifi ? 'wifi' : net.isCellular ? 'cellular' : 'unknown';

  return {
    device:      deviceLabel(),
    platform:    Platform.OS,
    osVersion:   String(Platform.Version ?? ''),
    appVersion:  APP_VERSION,
    buildNumber: BUILD_NUMBER,
    network,
    locale:      i18n?.language || 'en',
  };
}

// Same fields, formatted for on-screen display (label/value pairs).
export function diagnosticsRows(net = {}) {
  const d = collectDiagnostics(net);
  return [
    { label: 'Device', value: d.device },
    { label: 'Platform', value: `${d.platform} ${d.osVersion}`.trim() },
    { label: 'App Version', value: `${d.appVersion} (${d.buildNumber})` },
    { label: 'Network', value: d.network },
    { label: 'Language', value: d.locale },
  ];
}

export { APP_VERSION, BUILD_NUMBER };
