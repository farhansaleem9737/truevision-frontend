// truevision/screens/LoginActivityScreen.js
//
// Security → Login Activity. Newest-first session list from
// GET /api/security/login-activity with:
//   • "This device" badge on the current session
//   • Active vs ended state
//   • Swipe-free removal (trash icon) for ended sessions
//   • Pull-to-refresh + infinite scroll + skeleton first load

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StatusBar,
  ActivityIndicator, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import FadeInView from '../components/common/FadeInView';
import securityService from '../services/SecurityService';
import { useTheme } from '../context/ThemeContext';
import { useConfirm } from '../components/common/ConfirmProvider';

const iconForOS = (os = '') => {
  const s = os.toLowerCase();
  if (s.includes('ios') || s.includes('iphone')) return 'phone-portrait-outline';
  if (s.includes('android'))                     return 'phone-portrait-outline';
  if (s.includes('mac') || s.includes('win'))    return 'laptop-outline';
  return 'hardware-chip-outline';
};

const fmtWhen = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)        return 'just now';
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
};

const SkeletonRow = ({ colors }) => (
  <View style={[S.card, { backgroundColor: colors.card, borderColor: colors.divider }]}>
    <View style={[S.skelCircle, { backgroundColor: colors.divider }]} />
    <View style={{ flex: 1, gap: 8 }}>
      <View style={[S.skelLine, { backgroundColor: colors.divider, width: '55%' }]} />
      <View style={[S.skelLine, { backgroundColor: colors.divider, width: '80%' }]} />
    </View>
  </View>
);

export default function LoginActivityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const confirm = useConfirm();

  const [sessions,   setSessions]   = useState([]);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [removing,   setRemoving]   = useState(null);

  // Guards against overlapping fetches: onEndReached can fire several times
  // in a single fling, which without this would request the same page twice
  // and append duplicate rows.
  const inFlight = useRef(false);

  const load = useCallback(async (pageNum, replace = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError('');
    const res = await securityService.getLoginActivity(pageNum, 20);
    if (!res.success) {
      setError(res.message || 'Could not load login activity');
      setLoading(false); setRefreshing(false);
      inFlight.current = false;
      return;
    }
    setSessions((prev) => replace ? res.sessions : [...prev, ...res.sessions]);
    setHasMore((res.pagination?.page ?? pageNum) < (res.pagination?.pages ?? pageNum));
    setPage(pageNum);
    setLoading(false); setRefreshing(false);
    inFlight.current = false;
  }, []);

  useEffect(() => { load(1, true); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true); setHasMore(true); load(1, true);
  }, [load]);

  const onEnd = useCallback(() => {
    if (!loading && !refreshing && hasMore && !inFlight.current) load(page + 1);
  }, [loading, refreshing, hasMore, page, load]);

  const removeSession = async (session) => {
    const ok = await confirm({
      title:       'Remove from history',
      message:     'This removes the entry from your login activity. It does not sign that device out.',
      confirmText: 'Remove',
      destructive: true,
      icon:        'trash-outline',
    });
    if (!ok) return;
    setRemoving(session.id);
    const res = await securityService.deleteSession(session.id);
    setRemoving(null);
    if (res.success) {
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } else {
      Alert.alert('Could not remove', res.message || 'Try again later');
    }
  };

  const renderItem = ({ item }) => {
    const where = [item.city, item.country].filter(Boolean).join(', ');
    const stateColor = item.isCurrent ? '#22c55e' : item.isActive ? colors.accent : colors.textMuted;
    return (
      <View style={[S.card, { backgroundColor: colors.card, borderColor: colors.divider }]}>
        <View style={[S.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9' }]}>
          <Ionicons name={iconForOS(item.deviceOS)} size={20} color={stateColor} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={S.titleRow}>
            <Text style={[S.device, { color: colors.text }]} numberOfLines={1}>
              {item.deviceName || 'Unknown device'}
            </Text>
            {item.isCurrent && (
              <View style={S.currentBadge}>
                <Text style={S.currentBadgeText}>This device</Text>
              </View>
            )}
          </View>

          <Text style={[S.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {[item.deviceOS, where || null, item.ip ? `IP ${item.ip}` : null].filter(Boolean).join(' · ')}
          </Text>
          <Text style={[S.meta, { color: colors.textMuted }]}>
            Signed in {fmtWhen(item.loginAt)}
            {item.logoutAt  ? ` · signed out ${fmtWhen(item.logoutAt)}`  : ''}
            {item.revokedAt ? ` · revoked ${fmtWhen(item.revokedAt)}`    : ''}
            {item.isActive && !item.isCurrent ? ' · active' : ''}
          </Text>
        </View>

        {!item.isCurrent && (
          <TouchableOpacity
            onPress={() => removeSession(item)}
            disabled={removing === item.id}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {removing === item.id ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Login Activity" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} colors={colors} />)}
        </View>
      ) : error && sessions.length === 0 ? (
        <FadeInView style={S.stateBox}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={[S.stateTitle, { color: colors.text }]}>Couldn't load activity</Text>
          <Text style={[S.stateBody,  { color: colors.textMuted }]}>{error}</Text>
          <TouchableOpacity
            onPress={() => { setLoading(true); load(1, true); }}
            style={[S.retryBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </FadeInView>
      ) : sessions.length === 0 ? (
        <FadeInView style={S.stateBox}>
          <Ionicons name="laptop-outline" size={40} color={colors.textMuted} />
          <Text style={[S.stateTitle, { color: colors.text }]}>No login activity yet</Text>
          <Text style={[S.stateBody,  { color: colors.textMuted }]}>
            New sign-ins will appear here with device and location details.
          </Text>
        </FadeInView>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => String(s.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom, gap: 10 }}
          onEndReached={onEnd}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing} onRefresh={onRefresh}
              tintColor={colors.accent} colors={[colors.accent]}
            />
          }
          ListFooterComponent={hasMore ? (
            <ActivityIndicator style={{ marginTop: 8 }} size="small" color={colors.textMuted} />
          ) : null}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  device:   { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  currentBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  currentBadgeText: { color: '#16a34a', fontSize: 10.5, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 2 },

  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  stateTitle: { fontSize: 16, fontWeight: '800', marginTop: 6 },
  stateBody:  { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryBtn:   { marginTop: 12, borderRadius: 12, paddingHorizontal: 26, paddingVertical: 10 },
  retryText:  { color: '#fff', fontWeight: '800', fontSize: 14 },

  skelCircle: { width: 40, height: 40, borderRadius: 20 },
  skelLine:   { height: 10, borderRadius: 5 },
});
