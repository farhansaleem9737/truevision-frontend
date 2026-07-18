// truevision/screens/LicensesScreen.js
//
// Open Source Licenses. Renders the auto-generated assets/licenses.json
// (produced by scripts/generate-licenses.js from the installed dependencies)
// as a searchable, scrollable FlatList — library name, version, license,
// and copyright/author, with a tap-through to the project homepage.

import { useMemo, useState } from 'react';
import {
  FlatList, Linking, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import { useTheme } from '../context/ThemeContext';
import licensesData from '../assets/licenses.json';

const LIBRARIES = (licensesData?.libraries || [])
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name));

const open = (url) => url && Linking.openURL(url).catch(() => {});

export default function LicensesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LIBRARIES;
    return LIBRARIES.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.license || '').toLowerCase().includes(q),
    );
  }, [query]);

  const renderItem = ({ item }) => {
    const homepage = String(item.homepage || '').replace(/^git\+/, '').replace(/\.git$/, '');
    const tappable = /^https?:\/\//.test(homepage);
    return (
      <TouchableOpacity
        style={[S.row, { backgroundColor: colors.card, borderColor: colors.divider }]}
        activeOpacity={tappable ? 0.7 : 1}
        onPress={() => tappable && open(homepage)}
        disabled={!tappable}
      >
        <View style={{ flex: 1 }}>
          <View style={S.nameRow}>
            <Text style={[S.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[S.version, { color: colors.textDim }]}>v{item.version}</Text>
          </View>
          {item.author ? (
            <Text style={[S.author, { color: colors.textMuted }]} numberOfLines={1}>{item.author}</Text>
          ) : null}
        </View>
        <View style={[S.licenseBadge, { backgroundColor: colors.iconChipBg }]}>
          <Text style={[S.licenseText, { color: colors.textMuted }]}>{item.license || 'UNKNOWN'}</Text>
        </View>
        {tappable && <Ionicons name="open-outline" size={16} color={colors.textDim} style={{ marginLeft: 8 }} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Open Source Licenses" onBack={() => navigation.goBack()} />

      <View style={[S.search, { backgroundColor: colors.card, borderColor: colors.divider }]}>
        <Ionicons name="search" size={18} color={colors.textDim} />
        <TextInput
          style={[S.searchInput, { color: colors.text }]}
          placeholder="Search libraries…"
          placeholderTextColor={colors.textDim}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textDim} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={[S.count, { color: colors.textDim }]}>
            {data.length} of {LIBRARIES.length} libraries
          </Text>
        }
        ListEmptyComponent={
          <Text style={[S.empty, { color: colors.textDim }]}>No libraries match “{query}”.</Text>
        }
      />
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  search: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 44,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  count: { fontSize: 12, marginBottom: 12 },

  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  version: { fontSize: 12, marginLeft: 8 },
  author: { fontSize: 12, marginTop: 3 },
  licenseBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, marginLeft: 10 },
  licenseText: { fontSize: 11, fontWeight: '700' },

  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
