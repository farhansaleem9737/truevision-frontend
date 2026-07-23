// truevision/hooks/useAppActive.js
//
// Returns `true` while the app is in the FOREGROUND ('active'), `false` when it
// is backgrounded or inactive. Used to pause video playback the moment the app
// leaves the foreground and resume it on return — WITHOUT recreating the player,
// so the buffer is retained and the current video does not reload.

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export default function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      // 'inactive' (iOS transitional / control-center) is treated as not-active
      // so playback pauses immediately instead of bleeding audio in the switcher.
      setActive(next === 'active');
    });
    return () => sub.remove();
  }, []);

  return active;
}
