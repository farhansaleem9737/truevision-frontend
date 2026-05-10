// truevision/components/discover/HashtagResultRow.js
//
// Search result row for a hashtag. # icon, tag, video count.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const fmtCount = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

export default function HashtagResultRow({ tag, videosCount, onPress }) {
  return (
    <TouchableOpacity onPress={() => onPress?.(tag)} activeOpacity={0.6} style={S.row}>
      <View style={S.iconWrap}>
        <Ionicons name="pricetag" size={20} color="#0f172a" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={S.tag} numberOfLines={1}>#{tag}</Text>
        <Text style={S.count}>{fmtCount(videosCount)} {videosCount === 1 ? 'video' : 'videos'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  tag:    { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  count:  { fontSize: 12.5, color: '#64748b', marginTop: 2 },
});
