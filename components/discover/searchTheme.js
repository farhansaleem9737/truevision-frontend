// truevision/components/discover/searchTheme.js
//
// Scoped design tokens for the Search experience.
//
// The app's brand accent is purple (#6C5CFF — same value the bottom tab bar
// and Upload button already use), but the global ThemeContext `accent` is still
// blue. Rather than repaint every screen, the Search surface derives its own
// palette here: it starts from the live light/dark theme colours and overlays
// the purple brand + a few search-only roles (online dot, follow-button states,
// tinted section backgrounds). One import keeps every discover/* component and
// the Discover search mode visually consistent, in both themes.

import { useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';

// Brand purple (mirrors BottomTabNavigator's TAB_ACTIVE / Upload gradient).
export const BRAND = {
  purple:     '#6C5CFF',
  purpleDeep: '#4D63FF',
  online:     '#22c55e',
};

/**
 * Search palette = live theme colours + purple brand + search-only roles.
 * Memoised per theme flip so consumers get a stable object reference.
 */
export const useSearchTheme = () => {
  const { colors, isDark } = useTheme();

  return useMemo(() => ({
    ...colors,

    // Purple brand overrides the theme's blue accent, only inside Search.
    accent:       BRAND.purple,
    accentDeep:   BRAND.purpleDeep,
    accentGrad:   [BRAND.purple, BRAND.purpleDeep],
    // Low-opacity purple wash for icon chips / focus fills.
    accentSoft:   isDark ? 'rgba(108,92,255,0.20)' : 'rgba(108,92,255,0.10)',

    // Presence
    online:       BRAND.online,

    // Follow button — "Follow" (filled) vs "Following"/"Requested" (quiet).
    followBg:       BRAND.purple,
    followText:     '#ffffff',
    followingBg:    isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
    followingText:  colors.text,
    followingBorder: colors.divider,

    // Skeleton shimmer base
    skeleton:     isDark ? '#1c1c22' : '#eef1f6',
    skeletonHi:   isDark ? '#26262e' : '#f6f8fb',
  }), [colors, isDark]);
};

export default useSearchTheme;
