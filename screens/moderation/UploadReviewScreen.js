// truevision/screens/moderation/UploadReviewScreen.js
//
// The creator-facing "block screen" for a single upload that's in the
// moderation queue. Explains the status, shows the AI classification, and — for
// blocked / rejected / changes-requested videos with no open ticket — offers a
// "Request Review" button. Route: 'UploadReview', params: { video }.

import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const STATUS_META = {
  processing: {
    label: 'Processing', icon: 'hourglass-outline', color: '#F59E0B',
    title: 'Under review',
    desc: 'Your video is being analyzed. We’ll notify you once it’s published, or if any action is needed.',
  },
  pending_review: {
    label: 'Under review', icon: 'time-outline', color: '#F59E0B',
    title: 'Under manual review',
    desc: 'A reviewer is checking your video. You’ll be notified with the decision.',
  },
  blocked: {
    label: 'Blocked', icon: 'close-circle-outline', color: '#EF4444',
    title: 'Upload Blocked',
    desc: 'Your video appears to be classified as Entertainment Content.\n\nTrueVision currently prioritizes educational, professional and informative videos.\n\nIf you believe this classification is incorrect, you may request a manual review.',
  },
  rejected: {
    label: 'Rejected', icon: 'ban-outline', color: '#EF4444',
    title: 'Not approved',
    desc: 'A reviewer did not approve this video for publishing on TrueVision.',
  },
  changes_requested: {
    label: 'Changes requested', icon: 'create-outline', color: '#F59E0B',
    title: 'Changes requested',
    desc: 'A reviewer asked for changes. You can upload an improved version.',
  },
};

const APPEALABLE = ['blocked', 'rejected', 'changes_requested'];

export default function UploadReviewScreen({ route, navigation }) {
  const { colors } = useTheme();
  const [video, setVideo] = useState(route.params?.video || {});

  const status = video.reviewStatus || 'blocked';
  const meta   = STATUS_META[status] || STATUS_META.blocked;
  const ticket = video.reviewRequest || null;
  const hasOpenTicket = ticket && ticket.status === 'pending';
  const canRequest = APPEALABLE.includes(status) && !hasOpenTicket;

  const conf = video.review?.confidence != null ? Math.round(video.review.confidence * 100) : null;
  const cat  = video.review?.autoCategory || video.aiCategory || null;

  return (
    <SafeAreaView style={[S.root, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: colors.text }]}>Review status</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Thumbnail */}
        {video.thumbnailUrl ? (
          <ExpoImage source={{ uri: video.thumbnailUrl }} style={S.thumb} contentFit="cover" />
        ) : null}

        {/* Status pill + title */}
        <View style={[S.pill, { backgroundColor: meta.color + '22' }]}>
          <Ionicons name={meta.icon} size={15} color={meta.color} />
          <Text style={[S.pillText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        <Text style={[S.title, { color: colors.text }]}>{meta.title}</Text>
        {video.title ? <Text style={[S.videoTitle, { color: colors.textMuted }]} numberOfLines={2}>“{video.title}”</Text> : null}
        <Text style={[S.desc, { color: colors.textMuted }]}>{meta.desc}</Text>

        {/* Classification card */}
        {(cat || conf != null) && (
          <View style={[S.card, { backgroundColor: colors.card, borderColor: colors.divider }]}>
            <Text style={[S.cardHead, { color: colors.textDim }]}>AI CLASSIFICATION</Text>
            {cat != null && (
              <Row colors={colors} label="Category" value={String(cat)} />
            )}
            {conf != null && (
              <Row colors={colors} label="Confidence" value={`${conf}%`} />
            )}
            {video.review?.reason ? (
              <Row colors={colors} label="Reason" value={String(video.review.reason)} />
            ) : null}
          </View>
        )}

        {/* Admin feedback (reject / changes) */}
        {video.review?.adminNote ? (
          <View style={[S.card, { backgroundColor: colors.card, borderColor: colors.divider }]}>
            <Text style={[S.cardHead, { color: colors.textDim }]}>REVIEWER NOTE</Text>
            <Text style={[S.note, { color: colors.text }]}>{video.review.adminNote}</Text>
          </View>
        ) : null}

        {/* Ticket status */}
        {hasOpenTicket ? (
          <View style={[S.card, { backgroundColor: colors.card, borderColor: colors.divider }]}>
            <View style={S.rowCenter}>
              <Ionicons name="time-outline" size={18} color="#F59E0B" />
              <Text style={[S.ticketText, { color: colors.text }]}>Review request submitted — pending decision.</Text>
            </View>
          </View>
        ) : null}

        {/* Request Review CTA */}
        {canRequest && (
          <TouchableOpacity
            style={[S.cta, { backgroundColor: colors.accent }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('RequestReview', {
              video,
              onSubmitted: (updated) => setVideo((v) => ({ ...v, reviewRequest: updated })),
            })}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
            <Text style={S.ctaText}>Request Review</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({ colors, label, value }) => (
  <View style={S.detailRow}>
    <Text style={[S.detailLabel, { color: colors.textDim }]}>{label}</Text>
    <Text style={[S.detailValue, { color: colors.text }]} numberOfLines={2}>{value}</Text>
  </View>
);

const S = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  thumb:       { width: '100%', height: 200, borderRadius: 16, marginBottom: 18, backgroundColor: 'rgba(127,127,127,0.15)' },
  pill:        { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  pillText:    { fontSize: 13, fontWeight: '800', marginLeft: 6 },
  title:       { fontSize: 24, fontWeight: '900', marginBottom: 8 },
  videoTitle:  { fontSize: 14, marginBottom: 14, fontStyle: 'italic' },
  desc:        { fontSize: 15, lineHeight: 22 },
  card:        { borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 18 },
  cardHead:    { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 10 },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 13.5 },
  detailValue: { fontSize: 13.5, fontWeight: '700', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  note:        { fontSize: 14, lineHeight: 20 },
  rowCenter:   { flexDirection: 'row', alignItems: 'center' },
  ticketText:  { fontSize: 14, marginLeft: 8, flexShrink: 1 },
  cta:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 14, marginTop: 24 },
  ctaText:     { color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 8 },
});
