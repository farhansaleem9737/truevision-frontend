// truevision/context/LanguageContext.js
//
// App-wide language state on top of i18next. Responsibilities:
//   • Hydrate the saved language from AsyncStorage on boot (offline-first).
//   • Restore the account's language from the server after login.
//   • Apply a language instantly (text re-renders app-wide via i18next).
//   • Flip RTL/LTR layout direction and reload when it changes (RN requires a
//     restart for I18nManager.forceRTL to re-lay-out the tree).
//   • Persist locally + push to MongoDB; if the push fails (offline), keep the
//     local choice cached and mark it unsynced so it retries on next login /
//     via the Retry button. No rollback — the user's visible choice sticks.
//
// Consumers read via useLanguage(); UI strings come from useTranslation('t').

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n, { applyLanguage } from '../i18n';
import { LANGUAGES, DEFAULT_LANGUAGE, isRTLCode, normalizeCode } from '../i18n/languages';
import { reloadApp } from '../utils/reloadApp';
import settingsService from '../services/SettingsService';
import { useAuth } from './AuthContext';

const STORAGE_KEY  = '@truevision:language';
const UNSYNCED_KEY = '@truevision:language:unsynced';

const LanguageContext = createContext(null);

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
};

export const LanguageProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [language, setLanguageState] = useState(normalizeCode(i18n.language));
  const [changing, setChanging]      = useState(false);
  const [error, setError]            = useState(null); // { code, message } on sync failure
  const [ready, setReady]            = useState(false);

  // Ensure RTL is allowed at least once (forceRTL is a no-op otherwise).
  useEffect(() => { I18nManager.allowRTL(true); }, []);

  // Apply text + cache locally. Returns the code actually applied.
  const applyLocally = useCallback(async (rawCode) => {
    const applied = await applyLanguage(rawCode);      // loads bundle + changeLanguage
    setLanguageState(applied);
    await AsyncStorage.setItem(STORAGE_KEY, applied).catch(() => {});
    return applied;
  }, []);

  // Flip native layout direction if it differs. Returns true if a reload is
  // needed for the change to take visual effect.
  const applyDirection = useCallback((code) => {
    const nextRTL = isRTLCode(code);
    if (I18nManager.isRTL === nextRTL) return false;
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(nextRTL);
    return true;
  }, []);

  // ── Boot hydration ─────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const code   = normalizeCode(stored || i18n.language || DEFAULT_LANGUAGE);
        await applyLocally(code);
        // Self-heal a direction mismatch (extremely rare) without a boot-time
        // reload loop: forceRTL persists and takes effect on the next launch.
        if (I18nManager.isRTL !== isRTLCode(code)) {
          I18nManager.allowRTL(true);
          I18nManager.forceRTL(isRTLCode(code));
        }
      } catch (_) { /* fall back to default already applied */ }
      finally { if (alive) setReady(true); }
    })();
    return () => { alive = false; };
  }, [applyLocally]);

  // ── Restore from server after login ─────────────────────────────────────────
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated) { syncedRef.current = false; return; }
    if (syncedRef.current) return;
    syncedRef.current = true;

    (async () => {
      try {
        const [unsynced, current] = await Promise.all([
          AsyncStorage.getItem(UNSYNCED_KEY),
          AsyncStorage.getItem(STORAGE_KEY),
        ]);

        // A local change made offline wins — push it and stop (don't let the
        // server value clobber the user's newer choice).
        if (unsynced === '1' && current) {
          const r = await settingsService.updateLanguage(normalizeCode(current));
          if (r?.success) await AsyncStorage.removeItem(UNSYNCED_KEY);
          return;
        }

        // Otherwise pull the account's saved language and restore it.
        const res = await settingsService.getLanguage();
        if (!res?.success || !res.language) return;
        const server  = normalizeCode(res.language);
        const localNow = current ? normalizeCode(current) : DEFAULT_LANGUAGE;
        if (server === localNow) return;

        await applyLocally(server);
        if (applyDirection(server)) await reloadApp();
      } catch (_) { /* offline / server down — keep local */ }
    })();
  }, [isAuthenticated, applyLocally, applyDirection]);

  // ── Public: change language ─────────────────────────────────────────────────
  const setLanguage = useCallback(async (raw) => {
    const code = normalizeCode(raw);
    if (changing) return { success: false };
    if (code === language && !error) return { success: true };

    setChanging(true);
    setError(null);

    // 1. Instant, cached, optimistic apply.
    const applied     = await applyLocally(code);
    // 2. Layout direction (may require a reload to take effect).
    const needsReload = applyDirection(applied);
    // 3. Persist to the account.
    const res = await settingsService.updateLanguage(applied);

    if (!res?.success) {
      // Offline / server error: keep the local choice, flag for later sync.
      await AsyncStorage.setItem(UNSYNCED_KEY, '1').catch(() => {});
      setError({ code: applied, message: res?.message });
    } else {
      await AsyncStorage.removeItem(UNSYNCED_KEY).catch(() => {});
    }

    if (needsReload) { await reloadApp(); return res || { success: false }; }
    setChanging(false);
    return res || { success: false };
  }, [changing, language, error, applyLocally, applyDirection]);

  // ── Public: retry a failed server sync (language already applied locally) ────
  const retry = useCallback(async () => {
    setChanging(true);
    const res = await settingsService.updateLanguage(language);
    if (res?.success) {
      await AsyncStorage.removeItem(UNSYNCED_KEY).catch(() => {});
      setError(null);
    } else {
      setError({ code: language, message: res?.message });
    }
    setChanging(false);
    return res;
  }, [language]);

  const value = {
    language,
    isRTL: isRTLCode(language),
    languages: LANGUAGES,
    changing,
    error,
    ready,
    setLanguage,
    retry,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export default LanguageContext;
