// truevision/hooks/useNetworkStatus.js
//
// Thin wrapper around @react-native-community/netinfo that tells the app
// whether it's on Wi-Fi vs cellular. This is what makes the "HD Playback on
// Wi-Fi only" preference real — without a way to sense the connection type,
// that setting is inert.
//
// Returns:
//   { type, isWifi, isCellular, isConnected, isInternetReachable }
//
// Degrades gracefully: if the native module isn't present (e.g. a web build),
// it reports isWifi=true so playback defaults to full quality rather than
// wrongly throttling.

import { useEffect, useState } from 'react';

let NetInfo = null;
try {
  // Optional at require time so a missing native module can't crash the app.
  NetInfo = require('@react-native-community/netinfo').default
         || require('@react-native-community/netinfo');
} catch (_) {
  NetInfo = null;
}

const DEFAULT = {
  type: 'unknown',
  isWifi: true,          // fail-open: full quality when we can't tell
  isCellular: false,
  isConnected: true,
  isInternetReachable: true,
};

export default function useNetworkStatus() {
  const [state, setState] = useState(DEFAULT);

  useEffect(() => {
    if (!NetInfo) return;

    const apply = (s) => {
      if (!s) return;
      setState({
        type: s.type || 'unknown',
        isWifi: s.type === 'wifi' || s.type === 'ethernet',
        isCellular: s.type === 'cellular',
        isConnected: s.isConnected !== false,
        isInternetReachable: s.isInternetReachable !== false,
      });
    };

    // Prime once, then subscribe to changes.
    NetInfo.fetch().then(apply).catch(() => {});
    const unsub = NetInfo.addEventListener(apply);
    return () => { try { unsub && unsub(); } catch (_) {} };
  }, []);

  return state;
}
