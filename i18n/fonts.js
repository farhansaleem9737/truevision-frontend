// truevision/i18n/fonts.js
//
// Per-language font handling. Arabic and Urdu need a font that shapes the
// script correctly; the platform's system font already covers both scripts
// (Noto Naskh Arabic / Noto Sans Arabic on Android, SF Arabic on iOS), so we
// default to the system font and only override when a custom face is bundled.
//
// If you bundle a premium Nastaʿlīq face for Urdu (e.g. Noto Nastaliq Urdu),
// register it with expo-font and set FONT_BY_LANG.ur to its family name — no
// screen code changes needed; components pull the family from useLangFont().

// undefined family === platform system font (which renders every script we
// support). Kept as an explicit map so adding a bundled face is a one-liner.
const FONT_BY_LANG = {
  // ur: 'NotoNastaliqUrdu',   // ← set after bundling the .ttf via expo-font
  // ar: 'NotoNaskhArabic',
};

// Scripts that read more comfortably with a touch more line spacing.
const LOOSE_LINE_HEIGHT = new Set(['ur', 'ar']);

/** Font family for a language, or undefined to use the system font. */
export const fontFamilyFor = (code) => FONT_BY_LANG[code];

/** A line-height multiplier hint for scripts with tall glyphs/diacritics. */
export const lineHeightMultiplierFor = (code) =>
  LOOSE_LINE_HEIGHT.has(code) ? 1.35 : 1.2;
