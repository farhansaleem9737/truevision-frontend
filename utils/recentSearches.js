// truevision/utils/recentSearches.js
//
// Tiny AsyncStorage-backed history of recent search queries used by Discover.
// Most-recent first, deduped (case-insensitive), capped at MAX_ITEMS.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY       = '@truevision:recent-searches';
const MAX_ITEMS = 10;

const norm = (s) => (s || '').trim();
const sameAs = (a, b) => norm(a).toLowerCase() === norm(b).toLowerCase();

export const getRecentSearches = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw).filter(Boolean) : [];
  } catch { return []; }
};

export const addRecentSearch = async (query) => {
  const q = norm(query);
  if (!q) return;
  try {
    const current  = await getRecentSearches();
    const filtered = current.filter((x) => !sameAs(x, q));
    const next     = [q, ...filtered].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
};

export const removeRecentSearch = async (query) => {
  try {
    const current = await getRecentSearches();
    const next    = current.filter((x) => !sameAs(x, query));
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
};

export const clearRecentSearches = async () => {
  try { await AsyncStorage.removeItem(KEY); } catch {}
};
