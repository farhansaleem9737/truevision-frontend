// truevision/components/discover/UserResultRow.js
//
// Search result row for a user. Avatar + name + @username + bio + verified badge.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const initialOf = (name) =>
  name ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) : '?';

export default function UserResultRow({ user, onPress }) {
  const fullName = user?.fullName || user?.username || 'user';
  const username = user?.username || '';
  const bio      = user?.bio || '';

  return (
    <TouchableOpacity onPress={() => onPress?.(user)} activeOpacity={0.6} style={S.row}>
      {user?.profileImage ? (
        <ExpoImage
          source={{ uri: user.profileImage }}
          style={S.avatar}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[S.avatar, S.avatarFallback]}>
          <Text style={S.avatarInitials}>{initialOf(fullName)}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={S.nameRow}>
          <Text style={S.name} numberOfLines={1}>{fullName}</Text>
          {user?.isVerified ? (
            <Ionicons name="checkmark-circle" size={14} color="#3b82f6" style={{ marginLeft: 4 }} />
          ) : null}
        </View>
        <Text style={S.handle} numberOfLines={1}>@{username}</Text>
        {bio ? <Text style={S.bio} numberOfLines={1}>{bio}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 16,
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#e2e8f0', marginRight: 12,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6' },
  avatarInitials: { color: '#fff', fontWeight: '800', fontSize: 18 },

  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name:    { fontSize: 14.5, fontWeight: '700', color: '#0f172a' },
  handle:  { fontSize: 13, color: '#64748b', marginTop: 1 },
  bio:     { fontSize: 12.5, color: '#94a3b8', marginTop: 2 },
});
