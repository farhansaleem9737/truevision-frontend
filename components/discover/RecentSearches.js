// truevision/components/discover/RecentSearches.js
//
// Shown when the search bar is focused but empty. Tap a row to re-run that
// query, tap × to drop a single entry, or "Clear all" to wipe history.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RecentSearches({ items, onPick, onRemove, onClearAll }) {
  if (!items?.length) return null;

  return (
    <View style={S.wrap}>
      <View style={S.header}>
        <Text style={S.title}>Recent</Text>
        <TouchableOpacity onPress={onClearAll} hitSlop={S.hit}>
          <Text style={S.clear}>Clear all</Text>
        </TouchableOpacity>
      </View>

      {items.map((q) => (
        <TouchableOpacity
          key={q}
          onPress={() => onPick?.(q)}
          activeOpacity={0.6}
          style={S.row}
        >
          <View style={S.iconWrap}>
            <Ionicons name="time-outline" size={18} color="#64748b" />
          </View>
          <Text style={S.query} numberOfLines={1}>{q}</Text>
          <TouchableOpacity onPress={() => onRemove?.(q)} hitSlop={S.hit} style={S.removeBtn}>
            <Ionicons name="close" size={16} color="#94a3b8" />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { backgroundColor: '#fff', paddingTop: 4, paddingBottom: 14 },
  hit:  { top: 10, bottom: 10, left: 10, right: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  title: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  clear: { fontSize: 13, fontWeight: '700', color: '#3b82f6' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 16,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  query: { flex: 1, fontSize: 14.5, color: '#0f172a' },
  removeBtn: { padding: 6 },
});
