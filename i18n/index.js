// truevision/i18n/index.js
//
// i18next bootstrap for TrueVision.
//
// LAZY LOADING: only English (the fallback) is bundled into the i18next
// instance at startup. Every other language's JSON is pulled in on demand the
// first time it's selected, via a dynamic import, and registered as a resource
// bundle. So the initial JS eval never parses six locale files — only the one
// the user actually needs.
//
// compatibilityJSON 'v3' is used deliberately: it keeps plural handling on the
// legacy suffix system so we don't depend on Intl.PluralRules being present in
// the Hermes build (avoids a class of runtime crashes on older devices).

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, normalizeCode } from './languages';

// English is the fallback → bundle it synchronously so there's never a frame
// without strings, even before any async load resolves.
import en from './locales/en.json';

// Dynamic loaders. English resolves synchronously; the rest are code-split
// points that Metro evaluates lazily on first call.
const RESOURCE_LOADERS = {
  en: () => Promise.resolve(en),
  ur: () => import('./locales/ur.json'),
  ar: () => import('./locales/ar.json'),
  hi: () => import('./locales/hi.json'),
  tr: () => import('./locales/tr.json'),
  fr: () => import('./locales/fr.json'),
};

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'translation',
    ns: ['translation'],
    compatibilityJSON: 'v3',
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
    react: { useSuspense: false },         // we manage loading states ourselves
  });

/**
 * Ensure a language's resource bundle is loaded into i18next. Idempotent —
 * a bundle that's already present is a no-op, so repeated switches are cheap.
 * Falls back to English if the loader is missing or the import fails.
 */
export async function ensureLanguageLoaded(rawCode) {
  const code = normalizeCode(rawCode);
  if (code === DEFAULT_LANGUAGE) return DEFAULT_LANGUAGE;
  if (i18n.hasResourceBundle(code, 'translation')) return code;

  try {
    const loader = RESOURCE_LOADERS[code];
    if (!loader) return DEFAULT_LANGUAGE;
    const mod = await loader();
    const data = mod?.default || mod;
    i18n.addResourceBundle(code, 'translation', data, true, true);
    return code;
  } catch (err) {
    console.warn(`[i18n] failed to load "${code}":`, err?.message);
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Load (if needed) then switch to a language. Returns the code actually
 * applied (English if the requested one couldn't be loaded).
 */
export async function applyLanguage(rawCode) {
  const code = await ensureLanguageLoaded(rawCode);
  if (i18n.language !== code) await i18n.changeLanguage(code);
  return code;
}

export default i18n;
