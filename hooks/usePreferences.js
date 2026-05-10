// truevision/hooks/usePreferences.js
//
// Reads preferences from the AuthContext user (which the ProfileScreen keeps
// in sync with /api/users/me) and exposes a setter that writes to the backend
// via PUT /api/users/preferences. Updates are optimistic — local state changes
// immediately, the network call follows. On failure we revert.
//
// Usage:
//   const { prefs, setPath } = usePreferences();
//   setPath('privacy.privateAccount', true);
//   setPath('content.autoplay', false);

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import userService  from '../services/UserService';
import { useAuth }  from '../context/AuthContext';

const CACHE_KEY = '@truevision:preferences';

const DEFAULT_PREFS = {
  privacy: {
    privateAccount: false,
    hideOnlineStatus: false,
    hideFollowers: false,
    whoCanMessage: 'everyone',
    whoCanComment: 'everyone',
  },
  notifications: {
    likes: true, comments: true, newFollowers: true, messages: true,
    mentions: true, appUpdates: true,
    emailSecurity: true, emailNewsletter: false, emailPromotions: false, emailWeekly: false,
  },
  content: {
    autoplay: true, hdOnWifi: true, dataSaver: false,
    personalizedRecs: true, hideSensitive: false,
    interestedTopics: [],
  },
  language: 'en',
};

const deepMerge = (target, patch) => {
  if (typeof target !== 'object' || target === null) return patch;
  if (typeof patch  !== 'object' || patch  === null) return patch;
  if (Array.isArray(patch)) return patch;
  const out = { ...target };
  for (const k of Object.keys(patch)) out[k] = deepMerge(target[k], patch[k]);
  return out;
};

const setByPath = (obj, path, value) => {
  const keys = path.split('.');
  const out  = { ...obj };
  let cur    = out;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = { ...(cur[keys[i]] || {}) };
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return out;
};

const buildPatch = (path, value) => {
  const keys  = path.split('.');
  const patch = {};
  let   cur   = patch;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return patch;
};

export default function usePreferences() {
  const { user, updateUser } = useAuth();
  const [prefs, setPrefs]   = useState(() =>
    deepMerge(DEFAULT_PREFS, user?.preferences || {})
  );
  const [saving, setSaving] = useState(false);
  const previousRef = useRef(prefs);

  // Hydrate from AsyncStorage on mount (covers offline-first start)
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(CACHE_KEY).then((raw) => {
      if (!alive || !raw) return;
      try {
        const cached = JSON.parse(raw);
        setPrefs((p) => deepMerge(p, cached));
      } catch {}
    });
    return () => { alive = false; };
  }, []);

  // Sync local state when the auth user object refreshes
  useEffect(() => {
    if (!user?.preferences) return;
    setPrefs(deepMerge(DEFAULT_PREFS, user.preferences));
  }, [user?.preferences]);

  // Persist + push to server
  const setPath = useCallback(async (path, value) => {
    previousRef.current = prefs;
    const next = setByPath(prefs, path, value);
    setPrefs(next);
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});

    setSaving(true);
    const res = await userService.updatePreferences(buildPatch(path, value));
    setSaving(false);

    if (!res.success) {
      // Revert on failure
      setPrefs(previousRef.current);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(previousRef.current)).catch(() => {});
      return { success: false, message: res.message };
    }

    if (res.preferences) {
      const synced = deepMerge(DEFAULT_PREFS, res.preferences);
      setPrefs(synced);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(synced)).catch(() => {});
      // Also reflect into the in-memory user so other screens see it
      updateUser?.({ preferences: res.preferences });
    }
    return { success: true };
  }, [prefs, updateUser]);

  return { prefs, setPath, saving };
}
