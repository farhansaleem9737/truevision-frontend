// truevision/utils/recentSearches.js
//
// AsyncStorage-backed "Recent" list for Discover — Instagram-style. It stores
// the ENTITIES a user actually opened from search (profiles, and optionally
// hashtags / videos), NOT the letters they typed. Most-recent first, deduped
// by type+id, capped at MAX_ITEMS.
//
// Entry shape:
//   { type:'profile'|'hashtag'|'video', id, username, name, avatar, isVerified, ts }
//
// The old version stored raw query strings under a different key; we use a new
// key (…-v2) so legacy string data is simply ignored — no migration needed.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY       = '@truevision:recent-searches-v2';
const MAX_ITEMS = 12;

// Stable identity for dedupe: same profile/hashtag/video collapses to one row.
const keyOf = (e) => `${e?.type || 'profile'}:${String(e?.id || '')}`;

const normalize = (entry) => ({
  type:       entry.type || 'profile',
  id:         String(entry.id),
  username:   entry.username || '',
  name:       entry.name || entry.fullName || entry.displayName || '',
  avatar:     entry.avatar || entry.profileImage || '',
  isVerified: !!entry.isVerified,
  ts:         Date.now(),
});

/** Return the stored entries (well-formed only; legacy strings dropped). */
export const getRecentSearches = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((e) => e && typeof e === 'object' && e.id) : [];
  } catch { return []; }
};

/** Save an opened entity to the top, deduped, capped. Ignores anything without an id. */
export const addRecentSearch = async (entry) => {
  if (!entry || !entry.id) return;
  const e = normalize(entry);
  try {
    const current  = await getRecentSearches();
    const filtered = current.filter((x) => keyOf(x) !== keyOf(e));
    const next      = [e, ...filtered].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
};

/** Remove a single entry (pass the entry object, or a bare profile id string). */
export const removeRecentSearch = async (entryOrId) => {
  const target = typeof entryOrId === 'object'
    ? keyOf(entryOrId)
    : `profile:${String(entryOrId)}`;
  try {
    const current = await getRecentSearches();
    const next    = current.filter((x) => keyOf(x) !== target);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
};

export const clearRecentSearches = async () => {
  try { await AsyncStorage.removeItem(KEY); } catch {}
};
