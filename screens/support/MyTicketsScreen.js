// truevision/screens/support/MyTicketsScreen.js
//
// Lists the signed-in user's support tickets (GET /api/support/tickets) with
// status/priority, attachments count and admin replies. Offline-cached,
// pull-to-refresh, expandable rows. Empty + error states included.

import { useCallback, useState } from 'react';
import {
  ActivityIndicator, LayoutAnimation, Platform, RefreshControl, ScrollView,
  StatusBar, StyleSheet, Text, TouchableOpacity, UIManager, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../../components/settings/ScreenHeader';
import { useTheme } from '../../context/ThemeContext';
import useCachedResource from '../../hooks/useCachedResource';
import supportService from '../../services/SupportService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STATUS_COLOR = { open: '#f59e0b', in_progress: '#3b82f6', resolved: '#22c55e', closed: '#94a3b8' };
const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

function TicketCard({ ticket, open, onToggle, colors }) {
  const statusColor = STATUS_COLOR[ticket.status] || colors.textDim;
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onToggle} style={[S.card, { backgroundColor: colors.card }]}>
      <View style={S.cardHead}>
        <View style={[S.typeIcon, { backgroundColor: colors.iconChipBg }]}>
          <Ionicons name={ticket.type === 'bug' ? 'bug-outline' : 'mail-outline'} size={16} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[S.title, { color: colors.text }]} numberOfLines={open ? undefined : 1}>{ticket.title}</Text>
          <Text style={[S.meta, { color: colors.textDim }]}>
            {ticket.category} · {fmtDate(ticket.createdAt)}
          </Text>
        </View>
        <View style={[S.statusPill, { backgroundColor: statusColor + '22' }]}>
          <View style={[S.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[S.statusText, { color: statusColor }]}>{STATUS_LABEL[ticket.status] || ticket.status}</Text>
        </View>
      </View>

      {open && (
        <View style={S.body}>
          <Text style={[S.desc, { color: colors.textMuted }]}>{ticket.description}</Text>

          <View style={S.tags}>
            {ticket.attachments?.length > 0 && (
              <View style={[S.tag, { backgroundColor: colors.iconChipBg }]}>
                <Ionicons name="attach" size={13} color={colors.textMuted} />
                <Text style={[S.tagText, { color: colors.textMuted }]}>{ticket.attachments.length} attachment(s)</Text>
              </View>
            )}
            <View style={[S.tag, { backgroundColor: colors.iconChipBg }]}>
              <Ionicons name="flag-outline" size={13} color={colors.textMuted} />
              <Text style={[S.tagText, { color: colors.textMuted }]}>{ticket.priority}</Text>
            </View>
          </View>

          {ticket.replies?.length > 0 && (
            <View style={S.replies}>
              <Text style={[S.repliesTitle, { color: colors.textMuted }]}>Replies</Text>
              {ticket.replies.map((r, i) => (
                <View key={i} style={[S.reply, { backgroundColor: colors.iconChipBg }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.accent} />
                  <Text style={[S.replyText, { color: colors.text }]}>{r.message}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MyTicketsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [openId, setOpenId] = useState(null);

  const { data: tickets, loading, error, refreshing, refetch } =
    useCachedResource('support:tickets', () => supportService.getTickets({ page: 1, limit: 30 }), {
      pickData: (r) => r.tickets || [],
    });

  const toggle = useCallback((id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((cur) => (cur === id ? null : id));
  }, []);

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="My Requests" onBack={() => navigation.goBack()} />

      {loading && !tickets ? (
        <View style={S.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : error && !tickets ? (
        <View style={S.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textDim} />
          <Text style={[S.dim, { color: colors.textMuted }]}>Couldn't load your requests.</Text>
          <TouchableOpacity onPress={refetch} style={[S.retryBtn, { backgroundColor: colors.accent }]}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={!!refreshing} onRefresh={refetch} tintColor={colors.accent} />}
        >
          {(!tickets || tickets.length === 0) ? (
            <View style={S.empty}>
              <View style={[S.emptyCircle, { backgroundColor: colors.iconChipBg }]}>
                <Ionicons name="receipt-outline" size={40} color={colors.accent} />
              </View>
              <Text style={[S.emptyTitle, { color: colors.text }]}>No requests yet</Text>
              <Text style={[S.emptySub, { color: colors.textMuted }]}>Messages and bug reports you send will appear here.</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ContactUs')} style={[S.retryBtn, { backgroundColor: colors.accent, marginTop: 18 }]}>
                <Text style={S.retryText}>Contact Us</Text>
              </TouchableOpacity>
            </View>
          ) : (
            tickets.map((t) => (
              <View key={t._id} style={{ marginBottom: 12 }}>
                <TicketCard ticket={t} open={openId === t._id} onToggle={() => toggle(t._id)} colors={colors} />
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dim: { fontSize: 14, marginTop: 12, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 14 },
  retryText: { color: '#fff', fontWeight: '700' },

  card: { borderRadius: 14, padding: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  typeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  title: { fontSize: 14.5, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, marginLeft: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  statusText: { fontSize: 11.5, fontWeight: '700' },

  body: { marginTop: 12 },
  desc: { fontSize: 14, lineHeight: 21 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, marginRight: 8 },
  tagText: { fontSize: 12, fontWeight: '600', marginLeft: 5, textTransform: 'capitalize' },

  replies: { marginTop: 14 },
  repliesTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  reply: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 10, marginBottom: 8 },
  replyText: { flex: 1, fontSize: 13.5, lineHeight: 20, marginLeft: 8 },

  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 30 },
  emptyCircle: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub: { fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 },
});
