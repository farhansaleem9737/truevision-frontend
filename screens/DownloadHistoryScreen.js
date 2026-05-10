// truevision/screens/DownloadHistoryScreen.js
//
// Tracks videos the user has downloaded via the reel "More → Download" action.
// We keep a list of cached file URIs in AsyncStorage so users can re-share or
// remove them without hitting the network. Files live in expo-file-system's
// cacheDirectory, so they may be evicted by the OS — we filter those at load.

import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl, Share, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect }    from '@react-navigation/native';
import AsyncStorage          from '@react-native-async-storage/async-storage';
import * as FileSystem       from 'expo-file-system';
import { Ionicons }          from '@expo/vector-icons';
import ScreenHeader          from '../components/settings/ScreenHeader';

const KEY = '@truevision:downloads';

const fmtBytes = (bytes) => {
  if (!bytes) return '';
  if (bytes >= 1_073_741_824) return (bytes / 1_073_741_824).toFixed(2) + ' GB';
  if (bytes >= 1_048_576)     return (bytes / 1_048_576).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
};

const fmtDate = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const loadAll = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
const saveAll = async (arr) => {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(arr)); }
  catch {}
};

// Public helper used by ReelCard's MoreSheet to record a successful download.
export const recordDownload = async (entry) => {
  const all = await loadAll();
  const filtered = all.filter((e) => e.uri !== entry.uri);
  filtered.unshift({ ...entry, downloadedAt: Date.now() });
  await saveAll(filtered.slice(0, 100));
};

export default function DownloadHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const all = await loadAll();

    // Drop entries whose underlying file has been evicted from cache
    const live = [];
    for (const e of all) {
      try {
        const info = await FileSystem.getInfoAsync(e.uri);
        if (info.exists) live.push({ ...e, sizeBytes: info.size || e.sizeBytes });
      } catch {}
    }
    if (live.length !== all.length) await saveAll(live);

    setItems(live);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const removeOne = async (entry) => {
    Alert.alert('Remove download', `Delete "${entry.title || 'this video'}" from your device?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await FileSystem.deleteAsync(entry.uri, { idempotent: true }); } catch {}
        const next = items.filter((it) => it.uri !== entry.uri);
        setItems(next);
        await saveAll(next);
      }},
    ]);
  };

  const reshare = async (entry) => {
    try {
      await Share.share({ url: entry.uri, message: entry.title || 'Saved video' });
    } catch {}
  };

  const clearAll = () => {
    if (!items.length) return;
    Alert.alert('Clear history', 'Delete all downloaded videos from your device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete all', style: 'destructive', onPress: async () => {
        for (const e of items) {
          try { await FileSystem.deleteAsync(e.uri, { idempotent: true }); } catch {}
        }
        setItems([]);
        await saveAll([]);
      }},
    ]);
  };

  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScreenHeader
        title="Download History"
        onBack={() => navigation.goBack()}
        right={
          items.length ? (
            <TouchableOpacity onPress={clearAll}>
              <Text style={S.clearText}>Clear</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <View style={S.center}><ActivityIndicator color="#3b82f6" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.uri}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
          renderItem={({ item }) => (
            <View style={S.card}>
              <View style={S.cardThumb}>
                <Ionicons name="film-outline" size={26} color="#94a3b8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.cardTitle} numberOfLines={1}>
                  {item.title || 'Saved video'}
                </Text>
                <Text style={S.cardMeta}>
                  {fmtDate(item.downloadedAt)}{item.sizeBytes ? ` · ${fmtBytes(item.sizeBytes)}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => reshare(item)} style={S.cardBtn} hitSlop={S.hitSlop}>
                <Ionicons name="share-outline" size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeOne(item)} style={S.cardBtn} hitSlop={S.hitSlop}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={S.empty}>
              <Ionicons name="cloud-download-outline" size={42} color="#cbd5e1" />
              <Text style={S.emptyTitle}>No downloads yet</Text>
              <Text style={S.emptySub}>Use the three-dot menu on any reel to download a copy.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },

  clearText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    padding: 12, marginBottom: 10,
  },
  cardThumb: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: { fontSize: 14.5, fontWeight: '700', color: '#0f172a' },
  cardMeta:  { fontSize: 12.5, color: '#64748b', marginTop: 2 },
  cardBtn:   { padding: 8, marginLeft: 4 },

  empty: { alignItems: 'center', paddingTop: 90, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 14 },
  emptySub:   { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center' },
});
