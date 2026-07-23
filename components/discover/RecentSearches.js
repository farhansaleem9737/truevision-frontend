// truevision/components/discover/RecentSearches.js
//
// Instagram-style "Recent" list shown when the search bar is focused but empty.
// Each row is an ENTITY the user opened from search (a profile, hashtag, or
// video) — not a typed query. Tap a row to re-open it; × removes one entry;
// "Clear all" wipes the list. Theme-aware via useSearchTheme.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSearchTheme } from './searchTheme';

const initials = (name = '?') =>
  String(name).trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';

const RecentRow = ({ item, onPick, onRemove, c }) => {
  const isProfile = (item.type || 'profile') === 'profile';
  const isHashtag = item.type === 'hashtag';

  return (
    <TouchableOpacity onPress={() => onPick?.(item)} activeOpacity={0.6} style={S.row}>
      {/* Leading visual: avatar for profiles, glyph chip for hashtag/video */}
      {isProfile && item.avatar ? (
        <ExpoImage
          source={{ uri: item.avatar }}
          style={[S.avatar, { backgroundColor: c.iconChipBg }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={140}
        />
      ) : isProfile ? (
        <View style={[S.avatar, S.avatarFallback, { backgroundColor: c.accent }]}>
          <Text style={S.avatarInitials}>{initials(item.name || item.username)}</Text>
        </View>
      ) : (
        <View style={[S.iconWrap, { backgroundColor: c.iconChipBg }]}>
          <Ionicons name={isHashtag ? 'pricetag-outline' : 'play-outline'} size={18} color={c.textMuted} />
        </View>
      )}

      <View style={S.body}>
        <View style={S.nameRow}>
          <Text style={[S.name, { color: c.text }]} numberOfLines={1}>
            {isProfile ? (item.name || item.username || 'user')
              : isHashtag ? `#${item.name || item.username}`
              : (item.name || 'Video')}
          </Text>
          {isProfile && item.isVerified ? (
            <Ionicons name="checkmark-circle" size={13} color={c.accent} style={{ marginLeft: 4 }} />
          ) : null}
        </View>
        {isProfile && item.username ? (
          <Text style={[S.sub, { color: c.textMuted }]} numberOfLines={1}>@{item.username}</Text>
        ) : null}
      </View>

      <TouchableOpacity onPress={() => onRemove?.(item)} hitSlop={S.hit} style={S.removeBtn}>
        <Ionicons name="close" size={16} color={c.textDim} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default function RecentSearches({ items, onPick, onRemove, onClearAll }) {
  const c = useSearchTheme();
  if (!items?.length) return null;

  return (
    <View style={S.wrap}>
      <View style={S.header}>
        <Text style={[S.title, { color: c.text }]}>Recent</Text>
        <TouchableOpacity onPress={onClearAll} hitSlop={S.hit}>
          <Text style={[S.clear, { color: c.accent }]}>Clear all</Text>
        </TouchableOpacity>
      </View>

      {items.map((item) => (
        <RecentRow
          key={`${item.type || 'profile'}:${item.id}`}
          item={item}
          onPick={onPick}
          onRemove={onRemove}
          c={c}
        />
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { paddingTop: 4, paddingBottom: 14 },
  hit:  { top: 10, bottom: 10, left: 10, right: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  title: { fontSize: 14, fontWeight: '800' },
  clear: { fontSize: 13, fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 16,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, marginRight: 12,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '800', fontSize: 15 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  body:    { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name:    { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  sub:     { fontSize: 12.5, marginTop: 1 },
  removeBtn: { padding: 6 },
});
