// truevision/screens/admin/AdminReviewDetailScreen.js
//
// Full moderation detail for one video + the admin action bar. Route:
// 'AdminReviewDetail', params: { videoId }.
//   Actions: Approve · Reject · Request Changes · Delete · Warn · Suspend
// Reject / Request Changes / Warn / Suspend collect a note (shown to the creator).

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import adminService from '../../services/AdminService';
import { A, STATE_COLOR } from './adminTheme';

const ACTIONS = [
  { key: 'approve',         label: 'Approve',        icon: 'checkmark-circle', color: A.green, note: false },
  { key: 'reject',          label: 'Reject',         icon: 'close-circle',     color: A.red,   note: true },
  { key: 'request_changes', label: 'Request changes',icon: 'create',           color: A.amber, note: true },
  { key: 'warn',            label: 'Warn creator',   icon: 'warning',          color: A.amber, note: true },
  { key: 'delete',          label: 'Delete',         icon: 'trash',            color: A.red,   note: true },
  { key: 'suspend',         label: 'Suspend creator',icon: 'person-remove',    color: A.red,   note: true },
];

const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—';

export default function AdminReviewDetailScreen({ route, navigation }) {
  const { videoId } = route.params || {};
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null); // { action, label, note, color }
  const [busy, setBusy]   = useState(false);

  const load = useCallback(async () => {
    const res = await adminService.videoDetail(videoId).catch(() => null);
    setData(res?.success ? res : null);
    setLoading(false);
  }, [videoId]);

  useEffect(() => { load(); }, [load]);

  const runAction = async () => {
    if (!pending) return;
    setBusy(true);
    const res = await adminService.act(videoId, pending.action, pending.note || '');
    setBusy(false);
    setPending(null);
    if (res?.success) {
      Alert.alert('Done', `Action “${pending.label}” applied.`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } else {
      Alert.alert('Failed', res?.message || 'Could not apply the action.');
    }
  };

  if (loading) {
    return <SafeAreaView style={S.root}><ActivityIndicator style={{ marginTop: 60 }} color={A.accent} /></SafeAreaView>;
  }
  if (!data) {
    return (
      <SafeAreaView style={S.root}>
        <View style={S.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={26} color={A.text} /></TouchableOpacity>
          <Text style={S.headerTitle}>Detail</Text><View style={{ width: 26 }} />
        </View>
        <Text style={S.errText}>Could not load this video.</Text>
      </SafeAreaView>
    );
  }

  const { video, logs = [], reviewRequest } = data;
  const stateColor = STATE_COLOR[video.reviewStatus] || A.dim;
  const conf = video.review?.confidence != null ? Math.round(video.review.confidence * 100) : null;

  return (
    <SafeAreaView style={S.root} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={A.text} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Review</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Preview */}
        <ExpoImage source={{ uri: video.thumbnailUrl }} style={S.preview} contentFit="cover" />
        <View style={[S.statePill, { backgroundColor: stateColor + '22' }]}>
          <View style={[S.dot, { backgroundColor: stateColor }]} />
          <Text style={[S.statePillText, { color: stateColor }]}>{video.reviewStatus}</Text>
        </View>
        <Text style={S.title}>{video.title || 'Untitled'}</Text>
        {!!video.description && <Text style={S.desc} numberOfLines={4}>{video.description}</Text>}

        {/* Creator */}
        <Card title="CREATOR">
          <Row label="Username" value={`@${video.creator?.username || 'unknown'}`} />
          <Row label="Name" value={video.creator?.fullName || '—'} />
          <Row label="Suspended" value={video.creator?.isSuspended ? 'Yes' : 'No'} valueColor={video.creator?.isSuspended ? A.red : A.green} />
          <Row label="Uploaded" value={fmtDate(video.createdAt)} />
        </Card>

        {/* AI classification */}
        <Card title="AI CLASSIFICATION">
          <Row label="Auto category" value={video.review?.autoCategory || video.aiCategory || '—'} />
          <Row label="Informative score" value={video.informativeScore != null ? `${video.informativeScore}/10` : '—'} />
          {conf != null && <Row label="Confidence" value={`${conf}%`} />}
          <Row label="Decision" value={video.review?.decision || '—'} />
          <Row label="Decided by" value={video.review?.decidedBy || '—'} />
          {!!video.review?.reason && <Row label="Reason" value={video.review.reason} />}
        </Card>

        {/* NSFW + transcription */}
        {(video.moderation?.status || video.transcription?.status) && (
          <Card title="AI MODERATION DETAILS">
            {video.moderation?.status && <Row label="NSFW verdict" value={`${video.moderation.status} (${Math.round((video.moderation.confidence || 0) * 100)}%)`} />}
            {video.transcription?.status && <Row label="Transcript" value={video.transcription.status} />}
            {video.transcription?.category && <Row label="Speech category" value={video.transcription.category} />}
            {video.transcription?.language && <Row label="Language" value={video.transcription.language} />}
          </Card>
        )}

        {/* Review request */}
        {reviewRequest && (
          <Card title="REVIEW REQUEST">
            <Row label="Status" value={reviewRequest.status} valueColor={STATE_COLOR[reviewRequest.status] || A.text} />
            {!!reviewRequest.reason && <Row label="Reason" value={reviewRequest.reason} />}
            {!!reviewRequest.description && <Text style={S.para}>{reviewRequest.description}</Text>}
            {!!reviewRequest.notes && <Text style={S.para}>{reviewRequest.notes}</Text>}
            {(reviewRequest.links || []).map((l, i) => <Text key={i} style={S.link}>{l}</Text>)}
          </Card>
        )}

        {/* Audit log */}
        {logs.length > 0 && (
          <Card title="AUDIT LOG">
            {logs.map((l) => (
              <View key={l._id} style={S.logRow}>
                <Text style={S.logAction}>{l.action}</Text>
                <Text style={S.logMeta}>
                  {(l.actorType === 'admin' ? (l.adminName || 'admin') : l.actorType)} · {fmtDate(l.createdAt)}
                </Text>
                {!!l.note && <Text style={S.logNote}>{l.note}</Text>}
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* Action bar */}
      <View style={S.actionBar}>
        {ACTIONS.map((a) => (
          <TouchableOpacity
            key={a.key}
            style={S.actionBtn}
            onPress={() => (a.note ? setPending({ action: a.key, label: a.label, color: a.color, note: '' }) : setPending({ action: a.key, label: a.label, color: a.color, note: '', direct: true }))}
          >
            <Ionicons name={a.icon} size={20} color={a.color} />
            <Text style={[S.actionLabel, { color: a.color }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Note / confirm modal */}
      <Modal transparent visible={!!pending} animationType="fade" onRequestClose={() => setPending(null)}>
        <View style={S.modalBackdrop}>
          <View style={S.modalCard}>
            <Text style={S.modalTitle}>{pending?.label}</Text>
            <Text style={S.modalSub}>
              {pending?.direct ? 'Apply this action?' : 'Add a note for the creator (optional).'}
            </Text>
            {!pending?.direct && (
              <TextInput
                style={S.modalInput}
                placeholder="Note to the creator…"
                placeholderTextColor={A.dim}
                value={pending?.note}
                onChangeText={(t) => setPending((p) => ({ ...p, note: t }))}
                multiline
              />
            )}
            <View style={S.modalBtns}>
              <TouchableOpacity style={[S.modalBtn, { backgroundColor: A.card2 }]} onPress={() => setPending(null)} disabled={busy}>
                <Text style={[S.modalBtnText, { color: A.sub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.modalBtn, { backgroundColor: pending?.color || A.accent }]} onPress={runAction} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={S.modalBtnText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const Card = ({ title, children }) => (
  <View style={S.card}>
    <Text style={S.cardHead}>{title}</Text>
    {children}
  </View>
);
const Row = ({ label, value, valueColor }) => (
  <View style={S.detailRow}>
    <Text style={S.detailLabel}>{label}</Text>
    <Text style={[S.detailValue, valueColor && { color: valueColor }]} numberOfLines={2}>{value}</Text>
  </View>
);

const S = StyleSheet.create({
  root:        { flex: 1, backgroundColor: A.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: A.text, fontSize: 17, fontWeight: '800' },
  errText:     { color: A.dim, textAlign: 'center', marginTop: 40 },

  preview:     { width: '100%', height: 200, borderRadius: 14, backgroundColor: A.card2 },
  statePill:   { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginTop: 12 },
  dot:         { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statePillText:{ fontSize: 12.5, fontWeight: '800', textTransform: 'capitalize' },
  title:       { color: A.text, fontSize: 20, fontWeight: '900', marginTop: 10 },
  desc:        { color: A.sub, fontSize: 14, lineHeight: 20, marginTop: 8 },

  card:        { backgroundColor: A.card, borderRadius: 12, padding: 14, marginTop: 14 },
  cardHead:    { color: A.dim, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, marginBottom: 10 },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { color: A.dim, fontSize: 13 },
  detailValue: { color: A.text, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right', marginLeft: 12, textTransform: 'capitalize' },
  para:        { color: A.sub, fontSize: 13.5, lineHeight: 20, marginTop: 6 },
  link:        { color: A.accent, fontSize: 13, marginTop: 4 },

  logRow:      { borderTopWidth: 1, borderTopColor: A.border, paddingTop: 8, marginTop: 8 },
  logAction:   { color: A.text, fontSize: 13.5, fontWeight: '700', textTransform: 'capitalize' },
  logMeta:     { color: A.dim, fontSize: 11.5, marginTop: 2 },
  logNote:     { color: A.sub, fontSize: 12.5, marginTop: 4, fontStyle: 'italic' },

  actionBar:   { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: A.card, borderTopWidth: 1, borderTopColor: A.border, paddingVertical: 8, paddingHorizontal: 6, paddingBottom: 20 },
  actionBtn:   { width: '33.33%', alignItems: 'center', paddingVertical: 8 },
  actionLabel: { fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'center' },

  modalBackdrop:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard:   { backgroundColor: A.card, borderRadius: 16, padding: 20 },
  modalTitle:  { color: A.text, fontSize: 18, fontWeight: '800' },
  modalSub:    { color: A.dim, fontSize: 13.5, marginTop: 6, marginBottom: 12 },
  modalInput:  { backgroundColor: A.card2, borderRadius: 10, padding: 12, color: A.text, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 14 },
  modalBtns:   { flexDirection: 'row', gap: 10 },
  modalBtn:    { flex: 1, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalBtnText:{ color: '#fff', fontSize: 15, fontWeight: '800' },
});
