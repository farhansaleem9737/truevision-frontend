// truevision/components/video/VideoInfoPanel.js
//
// Bottom-sheet modal that opens when the user taps the ⓘ button on a video
// card or player. Shows transparent metadata about the video:
//
//   • Content type (Fact / News / Opinion)  + category
//   • Creator name + publish date
//   • Description (truncated)
//
//   If FACT:    Evidence links + attached documents (only when present)
//   If NEWS:    Publisher + source link + "Related Coverage" placeholder
//   If OPINION: Disclaimer banner
//
// The Related Coverage section is intentionally placeholder-only — backend
// fields (relatedContent, relatedNews, semanticMatches) exist on the Video
// schema so a future recommendation/clustering model can populate them
// without further frontend work.

import { useEffect, useRef } from 'react';
import {
  Animated, Dimensions, FlatList, Linking, Pressable,
  ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const { height } = Dimensions.get('window');

// Content-type → visible label + chip palette
const TYPE_META = {
  fact:    { label: 'Fact',    icon: 'checkmark-circle-outline',      fg: '#0f5132', bg: '#dcfce7' },
  news:    { label: 'News',    icon: 'newspaper-outline',             fg: '#075985', bg: '#e0f2fe' },
  opinion: { label: 'Opinion', icon: 'chatbubble-ellipses-outline',   fg: '#92400e', bg: '#fef3c7' },
};

const fmtDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return ''; }
};

const fileIcon = (type) => {
  if (type === 'image') return 'image-outline';
  if (type === 'pdf')   return 'document-text-outline';
  return 'document-outline';
};

const openLink = (url) => {
  if (!url) return;
  Linking.openURL(url).catch(() => {});
};

export default function VideoInfoPanel({ visible, onClose, video }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const slideY = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : height,
      useNativeDriver: true,
      friction: 26, tension: 240,
    }).start();
  }, [visible, slideY]);

  if (!video) return null;

  const type        = video.contentType || null;
  const typeMeta    = type ? TYPE_META[type] : null;
  const creator     = video.userId?.username || video.userId?.fullName || 'Creator';
  const category    = (video.category || 'other').replace(/_/g, ' ');

  // AI pipeline output (populated asynchronously after upload). The BART
  // zero-shot label is preferred; falls back to the ranking `aiCategory`.
  const aiClassification = video.transcription?.category || video.aiCategory || null;
  const infoScore   = Number(video.informativeScore) > 0
    ? Number(video.informativeScore).toFixed(1)
    : null;
  const underReview = video.transcription?.moderation === 'REVIEW';
  const publishDate = fmtDate(video.createdAt);

  // Section visibility based on type
  const hasEvidence = type === 'fact' && (
    (video.sourceFiles && video.sourceFiles.length > 0) ||
    (video.sourceUrl && video.sourceUrl.length > 0)
  );
  const hasNewsSource = type === 'news' && (
    (video.newsFiles && video.newsFiles.length > 0) ||
    !!video.newsUrl ||
    !!video.newsPublisher
  );

  return (
    <>
      {visible ? (
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={S.backdrop} />
        </TouchableWithoutFeedback>
      ) : null}

      <Animated.View style={[
        S.sheet,
        {
          backgroundColor: colors.card,
          paddingBottom: Math.max(insets.bottom, 14),
          transform: [{ translateY: slideY }],
        },
      ]}>
        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={[S.handle, { backgroundColor: colors.divider }]} />
        </View>

        {/* Header */}
        <View style={S.header}>
          <Text style={[S.title, { color: colors.text }]}>About this video</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={[S.divider, { backgroundColor: colors.divider }]} />

        <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 14 }} showsVerticalScrollIndicator={false}>
          {/* Type + category chip row */}
          <View style={S.chipRow}>
            {typeMeta ? (
              <View style={[S.chip, { backgroundColor: typeMeta.bg }]}>
                <Ionicons name={typeMeta.icon} size={14} color={typeMeta.fg} />
                <Text style={[S.chipText, { color: typeMeta.fg }]}>{typeMeta.label}</Text>
              </View>
            ) : null}
            {category ? (
              <View style={[S.chip, { backgroundColor: colors.surface }]}>
                <Ionicons name="pricetag-outline" size={13} color={colors.textMuted} />
                <Text style={[S.chipText, { color: colors.textMuted, textTransform: 'capitalize' }]}>
                  {category}
                </Text>
              </View>
            ) : null}

            {/* AI classification (Whisper→BART zero-shot). Falls back to the
                ranking category. Rendered only once the async pipeline fills it. */}
            {aiClassification ? (
              <View style={[S.chip, { backgroundColor: colors.surface }]}>
                <Ionicons name="sparkles-outline" size={13} color={colors.accent} />
                <Text style={[S.chipText, { color: colors.text, textTransform: 'capitalize' }]}>
                  AI: {aiClassification}{infoScore ? ` · ${infoScore}` : ''}
                </Text>
              </View>
            ) : null}

            {/* Text-moderation verdict from the classifier policy. */}
            {underReview ? (
              <View style={[S.chip, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="alert-circle-outline" size={13} color="#92400e" />
                <Text style={[S.chipText, { color: '#92400e' }]}>Under review</Text>
              </View>
            ) : null}
          </View>

          {/* Title */}
          {video.title ? (
            <Text style={[S.videoTitle, { color: colors.text }]} numberOfLines={2}>
              {video.title}
            </Text>
          ) : null}

          {/* Creator + date */}
          <View style={S.metaRow}>
            <Ionicons name="person-circle-outline" size={16} color={colors.textMuted} />
            <Text style={[S.metaText, { color: colors.textMuted }]}>{creator}</Text>
            {publishDate ? (
              <>
                <Text style={[S.metaDot, { color: colors.textDim }]}>·</Text>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={[S.metaText, { color: colors.textMuted }]}>{publishDate}</Text>
              </>
            ) : null}
          </View>

          {/* Description */}
          {video.description ? (
            <Text style={[S.description, { color: colors.textMuted }]}>
              {video.description}
            </Text>
          ) : null}

          {/* ── FACT: Evidence Links + Documents ──────────────────────────── */}
          {hasEvidence ? (
            <Section title="Evidence" colors={colors}>
              {video.sourceUrl ? (
                <LinkRow url={video.sourceUrl} colors={colors} />
              ) : null}
              {(video.sourceFiles || []).map((f, i) => (
                <FileRow key={`${f.publicId || f.url}-${i}`} file={f} colors={colors} />
              ))}
            </Section>
          ) : null}

          {/* ── NEWS: Publisher / Source / Related Coverage ───────────────── */}
          {hasNewsSource ? (
            <Section title="News Source" colors={colors}>
              {video.newsPublisher ? (
                <View style={[S.row, { backgroundColor: colors.surface }]}>
                  <Ionicons name="business-outline" size={16} color={colors.textMuted} />
                  <Text style={[S.rowText, { color: colors.text }]} numberOfLines={1}>
                    {video.newsPublisher}
                  </Text>
                </View>
              ) : null}
              {video.newsUrl ? <LinkRow url={video.newsUrl} colors={colors} /> : null}
              {(video.newsFiles || []).map((f, i) => (
                <FileRow key={`${f.publicId || f.url}-${i}`} file={f} colors={colors} />
              ))}
            </Section>
          ) : null}

          {/* Related Coverage placeholder — only shown for News. Backend fields
              (relatedNews / relatedContent / semanticMatches) are ready for a
              future model to populate; for now we render an empty-state hint. */}
          {type === 'news' ? (
            <Section title="Related Coverage" colors={colors}>
              {Array.isArray(video.relatedNews) && video.relatedNews.length > 0 ? (
                <FlatList
                  data={video.relatedNews}
                  keyExtractor={(it, i) => `${it.url}-${i}`}
                  renderItem={({ item }) => (
                    <Pressable onPress={() => openLink(item.url)} style={[S.row, { backgroundColor: colors.surface }]}>
                      <Ionicons name="link-outline" size={16} color={colors.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={[S.rowText, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                        {item.publisher ? (
                          <Text style={[S.rowSub, { color: colors.textDim }]}>{item.publisher}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  )}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                />
              ) : (
                <View style={[S.emptyRelated, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                  <Ionicons name="git-network-outline" size={18} color={colors.textDim} />
                  <Text style={[S.rowSub, { color: colors.textDim, flex: 1 }]}>
                    Related coverage will appear here as our recommendation engine grows.
                  </Text>
                </View>
              )}
            </Section>
          ) : null}

          {/* ── OPINION: Disclaimer ───────────────────────────────────────── */}
          {type === 'opinion' ? (
            <Section title="Disclaimer" colors={colors}>
              <View style={[S.disclaimer, { backgroundColor: TYPE_META.opinion.bg }]}>
                <Ionicons name="information-circle" size={18} color={TYPE_META.opinion.fg} />
                <Text style={[S.disclaimerText, { color: TYPE_META.opinion.fg }]}>
                  This content reflects personal analysis and interpretation.
                </Text>
              </View>
            </Section>
          ) : null}
        </ScrollView>
      </Animated.View>
    </>
  );
}

// ── Small layout helpers ────────────────────────────────────────────────────

const Section = ({ title, colors, children }) => (
  <View style={{ marginTop: 18 }}>
    <Text style={[S.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
    <View style={{ gap: 8 }}>{children}</View>
  </View>
);

const LinkRow = ({ url, colors }) => (
  <Pressable onPress={() => openLink(url)} style={[S.row, { backgroundColor: colors.surface }]}>
    <Ionicons name="link-outline" size={16} color={colors.accent} />
    <Text style={[S.rowText, { color: colors.accent }]} numberOfLines={1}>{url}</Text>
    <Ionicons name="open-outline" size={14} color={colors.textDim} />
  </Pressable>
);

const FileRow = ({ file, colors }) => (
  <Pressable onPress={() => openLink(file.url)} style={[S.row, { backgroundColor: colors.surface }]}>
    <Ionicons name={fileIcon(file.type)} size={16} color={colors.textMuted} />
    <Text style={[S.rowText, { color: colors.text }]} numberOfLines={1}>
      {file.name || (file.type === 'image' ? 'Image' : 'Document')}
    </Text>
    <Ionicons name="open-outline" size={14} color={colors.textDim} />
  </Pressable>
);

// ── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 50,
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    maxHeight: height * 0.85,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    zIndex: 100,
  },
  handle: { width: 38, height: 4, borderRadius: 2, marginBottom: 4 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12,
  },
  title:   { fontSize: 16, fontWeight: '800' },
  divider: { height: StyleSheet.hairlineWidth },

  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: '700' },

  videoTitle: { fontSize: 16.5, fontWeight: '800', marginBottom: 8, lineHeight: 22 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  metaText: { fontSize: 12.5, fontWeight: '600' },
  metaDot:  { fontSize: 12, marginHorizontal: 2 },

  description: { fontSize: 13.5, lineHeight: 19, marginTop: 4 },

  sectionTitle: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: 8,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 10,
  },
  rowText: { flex: 1, fontSize: 13, fontWeight: '600' },
  rowSub:  { fontSize: 12, marginTop: 2 },

  emptyRelated: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },

  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 10,
  },
  disclaimerText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
