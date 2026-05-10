// truevision/context/ThemeContext.js
//
// App-wide light/dark theme. Components read colours from `useTheme()` instead
// of hardcoding them, so a single toggle in Settings → Display can flip the
// chrome (tab bar, backgrounds, text, dividers, status bar).
//
// Persistence: AsyncStorage only — no backend round-trip, so the toggle
// reflects instantly and survives offline / app restart.
//
// Note: video-canvas screens (HomeScreen reel feed, VideoPlayer, ReelsFeed)
// stay dark in both modes by design — the player UX expects a black backdrop.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@truevision:theme';

// Semantic colour tokens. Add to both palettes when you need a new role —
// keeping names abstract (`bg`, `text`, `divider`) lets us swap palettes
// without touching screen code.
const lightColors = {
  bg:           '#ffffff',
  surface:      '#f8fafc',
  card:         '#ffffff',
  text:         '#0f172a',
  textMuted:    '#64748b',
  textDim:      '#94a3b8',
  divider:      '#e2e8f0',
  border:       '#eef2f7',
  iconChipBg:   '#f1f5f9',
  iconChipDanger: '#fef2f2',
  // Tab bar
  tabBg:        '#ffffff',
  tabBorder:    '#e2e8f0',
  tabIcon:      '#94a3b8',
  tabIconActive:'#0f172a',
  // Status bar
  statusBarStyle:'dark-content',
  statusBarBg:  '#ffffff',
  // Accents (don't change per mode)
  accent:       '#3b82f6',
  danger:       '#ef4444',
};

const darkColors = {
  bg:           '#0b0b0d',
  surface:      '#141418',
  card:         '#1a1a1f',
  text:         '#f5f5f7',
  textMuted:    '#a1a1aa',
  textDim:      '#71717a',
  divider:      '#27272a',
  border:       '#27272a',
  iconChipBg:   '#27272a',
  iconChipDanger:'#3a1a1c',
  // Tab bar
  tabBg:        '#0b0b0d',
  tabBorder:    '#27272a',
  tabIcon:      '#71717a',
  tabIconActive:'#ffffff',
  // Status bar
  statusBarStyle:'light-content',
  statusBarBg:  '#0b0b0d',
  // Accents
  accent:       '#60a5fa',
  danger:       '#f87171',
};

const ThemeContext = createContext({
  theme: 'light',
  isDark: false,
  colors: lightColors,
  setTheme: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState('light');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate persisted choice on mount
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light') setThemeState(stored);
      setHydrated(true);
    }).catch(() => setHydrated(true));
  }, []);

  const setTheme = useCallback((next) => {
    if (next !== 'light' && next !== 'dark') return;
    setThemeState(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    colors: theme === 'dark' ? darkColors : lightColors,
    setTheme,
    toggleTheme,
    hydrated,
  }), [theme, hydrated, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
