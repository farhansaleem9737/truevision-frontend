// truevision/components/discover/FollowButton.js
//
// Compact, self-contained Follow control for search-result rows.
//
//   none      → "Follow"     (filled purple)
//   following → "Following"  (quiet)
//   requested → "Requested"  (quiet — private accounts, awaiting approval)
//
// Optimistic with rollback: the label flips immediately, then reconciles with
// the server's real status ({ status: 'following' | 'requested' }); a failed
// request restores the previous relationship and surfaces an alert. Changes are
// lifted to the parent via `onChanged` so the same user stays in sync across
// the Top / Users tabs (both read from one `searchUsers` array).
//
// Relationship state is seeded from the enriched search payload
// (isFollowing / isRequested / isPrivate) — never a frontend guess.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, StyleSheet, Text } from 'react-native';
import userService from '../../services/UserService';
import { useSearchTheme } from './searchTheme';

const relOf = (u) => (u?.isFollowing ? 'following' : u?.isRequested ? 'requested' : 'none');
const LABEL = { none: 'Follow', following: 'Following', requested: 'Requested' };

export default function FollowButton({ user, onChanged, style }) {
  const c = useSearchTheme();
  const [rel, setRel]   = useState(() => relOf(user));
  const [busy, setBusy] = useState(false);

  // Re-seed when the row is recycled for a different user.
  useEffect(() => { setRel(relOf(user)); }, [user?._id]); // eslint-disable-line

  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  const emit = useCallback((next) => {
    onChanged?.(user._id, {
      isFollowing: next === 'following',
      isRequested: next === 'requested',
    });
  }, [onChanged, user?._id]);

  const onPress = useCallback(async () => {
    if (busy || !user?._id) return;
    const prev = rel;
    setBusy(true);

    // Optimistic flip.
    const optimistic = prev === 'none' ? (user.isPrivate ? 'requested' : 'following') : 'none';
    setRel(optimistic);
    emit(optimistic);

    const res = prev === 'none'
      ? await userService.followUser(user._id)
      : await userService.unfollowUser(user._id);

    if (!res?.success) {
      setRel(prev);            // rollback
      emit(prev);
      Alert.alert(
        prev === 'none' ? 'Could not follow' : 'Could not update',
        res?.message || 'Please try again.',
      );
    } else if (prev === 'none') {
      // Reconcile with the server's authoritative status.
      const confirmed = res.status === 'requested' ? 'requested' : 'following';
      setRel(confirmed);
      emit(confirmed);
    }
    setBusy(false);
  }, [busy, rel, user, emit]);

  const filled  = rel === 'none';
  const bg      = filled ? c.followBg : c.followingBg;
  const fg      = filled ? c.followText : c.followingText;
  const border  = filled ? 'transparent' : c.followingBorder;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={busy}
        hitSlop={6}
        style={[S.btn, { backgroundColor: bg, borderColor: border }, style]}
        accessibilityRole="button"
        accessibilityLabel={LABEL[rel]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <Text style={[S.label, { color: fg }]} numberOfLines={1}>{LABEL[rel]}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  btn: {
    minWidth: 92,
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 13.5, fontWeight: '700', letterSpacing: 0.2 },
});
