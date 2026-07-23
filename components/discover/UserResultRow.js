// truevision/components/discover/UserResultRow.js
//
// Premium search-result row for a user (Threads / Instagram style):
//
//   ( avatar•online )  Display Name ✓          [ Follow ]
//                      @username
//                      128 Videos · 52.3K Followers
//
// Theme-aware (light/dark) and purple-accented via useSearchTheme. Counts and
// follow state come from the enriched /users/search payload — no placeholders.
// When counts are absent (older backend) it degrades to the bio line so the row
// never looks empty.

import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import FollowButton from './FollowButton';
import { useSearchTheme } from './searchTheme';

const initialsOf = (name) =>
  name ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) : '?';

const fmtCount = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

function UserResultRow({ user, onPress, onFollowChanged, showFollow = true }) {
  const c = useSearchTheme();

  const name     = user?.displayName || user?.fullName || user?.username || 'user';
  const username = user?.username || '';
  const hasStats = user?.videosCount != null || user?.followersCount != null;

  // Meta line: "N Videos · M Followers" when we have counts, else the bio.
  const stats = hasStats
    ? [
        `${fmtCount(user.videosCount || 0)} ${user.videosCount === 1 ? 'Video' : 'Videos'}`,
        `${fmtCount(user.followersCount || 0)} Followers`,
      ].join('  ·  ')
    : (user?.bio || '');

  return (
    <TouchableOpacity onPress={() => onPress?.(user)} activeOpacity={0.6} style={S.row}>
      {/* Avatar + online dot */}
      <View style={S.avatarWrap}>
        {user?.profileImage ? (
          <ExpoImage
            source={{ uri: user.profileImage }}
            style={S.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={user._id}
            transition={140}
          />
        ) : (
          <View style={[S.avatar, S.avatarFallback, { backgroundColor: c.accent }]}>
            <Text style={S.avatarInitials}>{initialsOf(name)}</Text>
          </View>
        )}
        {user?.isOnline ? (
          <View style={[S.onlineDot, { backgroundColor: c.online, borderColor: c.bg }]} />
        ) : null}
      </View>

      {/* Identity */}
      <View style={S.body}>
        <View style={S.nameRow}>
          <Text style={[S.name, { color: c.text }]} numberOfLines={1}>{name}</Text>
          {user?.isVerified ? (
            <Ionicons name="checkmark-circle" size={15} color={c.accent} style={S.verified} />
          ) : null}
          {user?.isPrivate ? (
            <Ionicons name="lock-closed" size={11} color={c.textDim} style={S.lock} />
          ) : null}
        </View>
        <Text style={[S.handle, { color: c.textMuted }]} numberOfLines={1}>@{username}</Text>
        {stats ? (
          <Text style={[S.stats, { color: c.textDim }]} numberOfLines={1}>{stats}</Text>
        ) : null}
      </View>

      {/* Follow */}
      {showFollow ? (
        <FollowButton user={user} onChanged={onFollowChanged} style={S.follow} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={c.textDim} />
      )}
    </TouchableOpacity>
  );
}

export default memo(UserResultRow);

const S = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 16,
  },
  avatarWrap: { marginRight: 12 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(120,120,140,0.15)' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '800', fontSize: 19 },
  onlineDot: {
    position: 'absolute', right: 1, bottom: 1,
    width: 14, height: 14, borderRadius: 7, borderWidth: 2.5,
  },

  body: { flex: 1, marginRight: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  verified: { marginLeft: 4 },
  lock: { marginLeft: 5 },
  handle: { fontSize: 13, marginTop: 1 },
  stats: { fontSize: 12.5, marginTop: 3, fontWeight: '500' },

  follow: {},
});
