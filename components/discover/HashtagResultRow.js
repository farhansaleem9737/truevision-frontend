// truevision/components/discover/HashtagResultRow.js
//
// Search-result row for a hashtag. Purple # chip, tag, video count.
// Theme-aware via useSearchTheme (light/dark).

import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSearchTheme } from './searchTheme';

const fmtCount = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

function HashtagResultRow({ tag, videosCount, onPress }) {
  const c = useSearchTheme();
  return (
    <TouchableOpacity onPress={() => onPress?.(tag)} activeOpacity={0.6} style={S.row}>
      <View style={[S.iconWrap, { backgroundColor: c.accentSoft }]}>
        <Ionicons name="pricetag" size={19} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[S.tag, { color: c.text }]} numberOfLines={1}>#{tag}</Text>
        <Text style={[S.count, { color: c.textMuted }]}>
          {fmtCount(videosCount)} {videosCount === 1 ? 'video' : 'videos'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textDim} />
    </TouchableOpacity>
  );
}

export default memo(HashtagResultRow);

const S = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 16,
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  tag:   { fontSize: 15, fontWeight: '800' },
  count: { fontSize: 12.5, marginTop: 2, fontWeight: '500' },
});
