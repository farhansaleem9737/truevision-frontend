// truevision/i18n/languages.js
//
// Single source of truth for the languages the app supports.
//
// SCALABILITY: adding a language is a 3-step, code-free-ish change:
//   1. Add an entry here (code, label, native, rtl).
//   2. Drop a locale file at i18n/locales/<code>.json.
//   3. Register its lazy loader in i18n/index.js (RESOURCE_LOADERS).
//   4. Add the code to the enum in Backend/models/User.js + SettingsController.
// Nothing else in the app hardcodes a language list.

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English',  rtl: false },
  { code: 'ur', label: 'Urdu',    native: 'اُردُو',    rtl: true  },
  { code: 'ar', label: 'Arabic',  native: 'العربية',  rtl: true  },
  { code: 'hi', label: 'Hindi',   native: 'हिन्दी',    rtl: false },
  { code: 'tr', label: 'Turkish', native: 'Türkçe',   rtl: false },
  { code: 'fr', label: 'French',  native: 'Français', rtl: false },
];

export const DEFAULT_LANGUAGE = 'en';

export const SUPPORTED_CODES = LANGUAGES.map((l) => l.code);

const byCode = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]));

/** Whether a language code renders right-to-left. Unknown codes → false. */
export const isRTLCode = (code) => !!byCode[code]?.rtl;

/** Look up the full descriptor for a code (or undefined). */
export const getLanguage = (code) => byCode[code];

/** Normalise any input to a supported code, falling back to English. */
export const normalizeCode = (code) => {
  if (!code) return DEFAULT_LANGUAGE;
  const base = String(code).toLowerCase().split('-')[0]; // 'en-US' → 'en'
  return byCode[base] ? base : DEFAULT_LANGUAGE;
};
