// truevision/utils/profileNavigation.js
//
// THE single source of truth for opening a user profile anywhere in the app.
//
// Ownership rule (Instagram / TikTok / Threads behaviour):
//   loggedInUser._id === targetUser._id  → open MY Profile  (the Profile tab)
//   otherwise                            → open User Profile (UserProfile route)
//
// Every surface — Video Player, Comments, Chat, Followers, Following, Search,
// Notifications, Mentions — MUST use `useProfileNavigation()` (or the pure
// `navigateToProfile`) instead of calling navigation.navigate('UserProfile')
// directly, so the own-vs-other decision lives in exactly one place.
//
// Route facts this encodes (see navigation/BottomTabNavigator.js + App.js):
//   • My profile is the bottom-tab `Profile` (nested stack → ProfileMain),
//     reached from anywhere via navigate('MainApp', { screen: 'Profile' }).
//   • Another user's profile is the root-stack `UserProfile` route, param userId.

import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

/**
 * Coerce anything id-ish to a comparable string.
 * Accepts a raw id string, or a populated user/creator object ({ _id } / { id }).
 * This lets callers pass `item.userId` whether it's an ObjectId string or a
 * populated document — the common shape returned by our APIs.
 */
export const idOf = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return String(v._id || v.id || '');
  return String(v);
};

/**
 * Pure navigation decision. Prefer the `useProfileNavigation` hook in
 * components; use this directly only where a hook can't run (e.g. a helper
 * that already holds `navigation` + the current user id).
 *
 * @param {object} navigation      react-navigation navigation object
 * @param {string|object} target   target user id (or populated user)
 * @param {string|object} me       current logged-in user id (or user)
 * @param {object} [options]       { push?: boolean, ...extraParams }
 *        push:true drills a NEW UserProfile onto the stack (used by the
 *        Followers/Following/Requests lists so profile → its list → profile →
 *        … stays a real back-stack instead of collapsing onto one instance).
 *        Any other keys are forwarded as route params to UserProfile.
 * @returns {'self'|'other'|null}  which branch was taken (handy for tests)
 */
export function navigateToProfile(navigation, target, me, options = {}) {
  const targetId = idOf(target);
  if (!navigation || !targetId) return null;

  const { push = false, ...params } = options;
  const myId = idOf(me);

  if (myId && myId === targetId) {
    // Own profile → switch to the Profile tab. Works from a tab screen, a
    // root-stack screen (VideoPlayer, UserProfile, Chat…) or a nested stack.
    navigation.navigate('MainApp', { screen: 'Profile' });
    return 'self';
  }

  if (push && typeof navigation.push === 'function') {
    navigation.push('UserProfile', { userId: targetId, ...params });
  } else {
    navigation.navigate('UserProfile', { userId: targetId, ...params });
  }
  return 'other';
}

/**
 * Hook returning a stable `openProfile(targetUserId, extra)` that applies
 * ownership detection automatically by reading the authenticated user.
 *
 * Usage:
 *   const openProfile = useProfileNavigation();
 *   <Pressable onPress={() => openProfile(comment.userId)} />
 */
export function useProfileNavigation() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const myId = user?._id || user?.id;

  return useCallback(
    (targetUserId, extra) => navigateToProfile(navigation, targetUserId, myId, extra),
    [navigation, myId],
  );
}

export default useProfileNavigation;
