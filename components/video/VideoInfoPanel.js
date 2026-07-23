// truevision/components/video/VideoInfoPanel.js
//
// Bottom-sheet modal that opens when the user taps the ⓘ button on a video
// card or player. Shows transparent metadata about the video:
//
//   • Content type (Fact / News / Opinion)  + category + AI classification
//   • Creator name + publish date + description
//
//   If FACT:    Evidence links + attached documents (only when present)
//   If NEWS:    Publisher + source link + "Related Coverage" placeholder
//   If OPINION: Disclaimer banner
//
// Evidence system (production behaviour):
//   • Links — the stored string is free-form (creators paste "Title https://…");
//     extractUrl() recovers the real URL. Cards show favicon + fetched page
//     title + domain (cached via services/evidenceMeta), with a skeleton while
//     loading and a friendly "Source is currently unavailable" + Retry state.
//     Tapping opens an in-app browser tab (falls back to the system browser);
//     a Copy button copies the FULL URL with a "Link copied." toast.
//   • PDFs — cached download with a live progress bar, then opened in the
//     device's PDF viewer (Android VIEW intent via content://; iOS in-app
//     browser). Missing/deleted files and network failures surface as the
//     unavailable card with Retry — never a crash, never a dead tap.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator, Animated, Dimensions, FlatList, Linking, Platform,
  Pressable, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy'; // SDK54: classic API lives here
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import videoService from '../../services/VideoService';
import { extractUrl, getDomain, faviconFor, getMeta, peekMeta } from '../../services/evidenceMeta';

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

const fmtBytes = (b) => {
  const n = Number(b);
  if (!n || n <= 0) return null;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// ── URL opening (validated, browser-safe, never silent) ─────────────────────
const openEvidenceUrl = async (rawUrl, toast) => {
  const url = extractUrl(rawUrl);
  if (!url) { toast('This link is invalid.'); return; }
  return openTrustedUrl(url, toast);
};

// Open a URL we already know is well-formed (e.g. a signed download link from
// our own API) — skips extractUrl's free-text parsing.
const openTrustedUrl = async (url, toast) => {
  try {
    // In-app browser tab (Chrome Custom Tab / SFSafariVC) — handles HTTPS,
    // redirects and certificates natively, like Instagram/TikTok.
    await WebBrowser.openBrowserAsync(url);
  } catch {
    try { await Linking.openURL(url); }
    catch { toast("Couldn't open the link."); }
  }
};

const copyUrl = async (rawUrl, toast) => {
  const url = extractUrl(rawUrl) || String(rawUrl || '').trim();
  if (!url) { toast('Nothing to copy.'); return; }
  try {
    await Clipboard.setStringAsync(url);   // full URL — display truncation never affects the copy
    toast('Link copied.');
  } catch {
    toast("Couldn't copy the link.");
  }
};

// ── Skeleton shimmer row ────────────────────────────────────────────────────
const SkeletonCard = ({ colors }) => {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={[S.card, { backgroundColor: colors.surface, opacity: pulse }]}>
      <View style={[S.favicon, { backgroundColor: colors.divider }]} />
      <View style={{ flex: 1, gap: 7 }}>
        <View style={{ height: 12, borderRadius: 6, width: '82%', backgroundColor: colors.divider }} />
        <View style={{ height: 9,  borderRadius: 5, width: '40%', backgroundColor: colors.divider }} />
      </View>
    </Animated.View>
  );
};

// ── "Source unavailable" card + Retry ───────────────────────────────────────
const UnavailableCard = ({ colors, onRetry, title, sub }) => (
  <View style={[S.card, { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider }]}>
    <View style={[S.favicon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
      <Ionicons name="cloud-offline-outline" size={18} color="#ef4444" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[S.cardTitle, { color: colors.text }]} numberOfLines={1}>{title || 'Source is currently unavailable.'}</Text>
      <Text style={[S.cardSub, { color: colors.textDim }]} numberOfLines={1}>{sub || 'Check your connection and try again'}</Text>
    </View>
    <Pressable
      onPress={onRetry}
      style={[S.iconBtn, { backgroundColor: colors.iconChipBg || colors.divider }]}
      android_ripple={{ color: colors.divider, borderless: true, radius: 22 }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Retry loading source"
    >
      <Ionicons name="refresh" size={17} color={colors.text} />
    </Pressable>
  </View>
);

// ── Evidence LINK card: favicon + title + domain + copy + open ──────────────
const EvidenceLinkCard = ({ rawUrl, colors, toast }) => {
  const url = extractUrl(rawUrl);
  const [meta, setMeta] = useState(url ? peekMeta(url) : null);
  const [loading, setLoading] = useState(!!url && !meta);
  const [attempt, setAttempt] = useState(0);
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    if (!meta) setLoading(true);
    getMeta(url).then((m) => { if (alive) { setMeta(m); setLoading(false); } });
    return () => { alive = false; };
  }, [url, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nothing openable in the stored string — show it read-only with copy so the
  // information is never lost, but no dead "open" affordance.
  if (!url) {
    return (
      <View style={[S.card, { backgroundColor: colors.surface }]}>
        <View style={[S.favicon, { backgroundColor: colors.iconChipBg || colors.divider }]}>
          <Ionicons name="link-outline" size={17} color={colors.textMuted} />
        </View>
        <Text style={[S.cardTitle, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>{String(rawUrl || '')}</Text>
      </View>
    );
  }

  if (loading) return <SkeletonCard colors={colors} />;
  if (meta && !meta.ok && !meta.title) {
    return <UnavailableCard colors={colors} onRetry={() => setAttempt((n) => n + 1)} />;
  }

  const domain = meta?.domain || getDomain(url);
  const title  = meta?.title || domain;
  const fav    = meta?.favicon || faviconFor(url);

  return (
    <Pressable
      onPress={() => openEvidenceUrl(url, toast)}
      style={({ pressed }) => [S.card, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}
      android_ripple={{ color: colors.divider }}
      accessibilityRole="link"
      accessibilityLabel={`Open source: ${title}`}
    >
      <View style={[S.favicon, { backgroundColor: colors.iconChipBg || colors.divider }]}>
        {fav && !iconFailed ? (
          <ExpoImage
            source={{ uri: fav }}
            style={{ width: 20, height: 20, borderRadius: 4 }}
            cachePolicy="memory-disk"
            onError={() => setIconFailed(true)}
          />
        ) : (
          <Ionicons name="link-outline" size={17} color={colors.accent} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[S.cardTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        <Text style={[S.cardSub, { color: colors.textDim }]} numberOfLines={1}>{domain}</Text>
      </View>

      <Pressable
        onPress={(e) => { e.stopPropagation?.(); copyUrl(url, toast); }}
        style={[S.iconBtn, { backgroundColor: colors.iconChipBg || colors.divider }]}
        android_ripple={{ color: colors.divider, borderless: true, radius: 22 }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Copy link"
      >
        <Ionicons name="copy-outline" size={16} color={colors.text} />
      </Pressable>
      <Ionicons name="open-outline" size={16} color={colors.textDim} style={{ marginLeft: 8 }} />
    </Pressable>
  );
};

// ── Evidence FILE card (PDF / image / document) ─────────────────────────────
const sanitizeName = (s) => String(s || 'document').replace(/[^\w.\-]+/g, '_').slice(0, 80);

const FileCard = ({ file, videoId, field, index, colors, toast }) => {
  const [phase, setPhase] = useState('idle');      // idle | downloading | error
  const [progress, setProgress] = useState(0);
  // Re-entry guard held for the WHOLE open flow (including while the in-app
  // browser is presented — openBrowserAsync resolves on dismiss). The phase
  // state alone can't cover that window without pinning a spinner on screen.
  const openingRef = useRef(false);

  const isPdf   = file.type === 'pdf' || /\.pdf(\?|$)/i.test(file.url || '');
  const isImage = file.type === 'image';
  const name    = file.name || (isPdf ? 'PDF document' : isImage ? 'Image' : 'Document');
  const size    = fmtBytes(file.size);

  // The stored Cloudinary URL for raw docs (PDF/Word/…) is NOT publicly
  // deliverable — the account blocks raw PDF delivery (401). The backend
  // mints a short-lived authenticated link instead. Returns null when the
  // link can't be resolved: falling back to the stored URL would just open
  // Cloudinary's 401 page, so callers show the unavailable card instead.
  // Images (and external items with no DB id) keep using the stored URL.
  const resolveUrl = useCallback(async () => {
    if (isImage || !videoId) return file.url;
    const res = await videoService.getEvidenceFileUrl(videoId, field, index);
    return res?.success && res.url ? res.url : null;
  }, [isImage, videoId, field, index, file.url]);

  const openFile = useCallback(async () => {
    if (openingRef.current) return;
    if (!file.url) { toast('This file is unavailable.'); return; }
    openingRef.current = true;
    try {
      // Images + generic documents: the in-app browser renders/downloads them.
      // PDFs on iOS: the in-app Safari view renders PDFs natively from the URL.
      if (!isPdf || Platform.OS !== 'android') {
        setPhase('downloading'); setProgress(0);   // brief spinner while resolving
        const url = await resolveUrl();
        if (!url) { setPhase('error'); return; }
        setPhase('idle');
        await openTrustedUrl(url, toast);          // guard stays held until dismissed
        return;
      }

      // PDFs on Android: download (cached) → open with the device PDF viewer.
      try {
        setPhase('downloading'); setProgress(0);
        // Cache key: publicId is globally unique; legacy rows without one fall
        // back to videoId+field+index so same-named files never collide.
        const cacheKey = file.publicId || `${videoId || 'file'}-${field || 'src'}-${index || 0}-${name}`;
        const target = `${FileSystem.cacheDirectory}evidence-${sanitizeName(cacheKey)}.pdf`;

        const info = await FileSystem.getInfoAsync(target);
        let uri = info.exists && info.size > 0 ? target : null;

        if (!uri) {
          const freshUrl = await resolveUrl();
          if (!freshUrl) { setPhase('error'); return; }
          const dl = FileSystem.createDownloadResumable(
            freshUrl, target, {},
            (p) => {
              if (p.totalBytesExpectedToWrite > 0) {
                setProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
              }
            },
          );
          const res = await dl.downloadAsync();
          if (!res?.uri || (res.status && res.status >= 400)) {
            try { await FileSystem.deleteAsync(target, { idempotent: true }); } catch {}
            throw new Error(`HTTP ${res?.status || 'download failed'}`);
          }
          uri = res.uri;
        }

        const contentUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,                       // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/pdf',
        });
        setPhase('idle');
      } catch (err) {
        // No installed PDF viewer → fall back to the browser; anything else
        // (404 deleted asset, network loss) → unavailable card with Retry.
        if (/No Activity found/i.test(err?.message || '')) {
          const url = await resolveUrl();
          if (!url) { setPhase('error'); return; }
          setPhase('idle');
          await openTrustedUrl(url, toast);
          return;
        }
        setPhase('error');
      }
    } finally {
      openingRef.current = false;
    }
  }, [file.url, file.publicId, isPdf, name, toast, resolveUrl, videoId, field, index]);

  if (phase === 'error') {
    return (
      <UnavailableCard
        colors={colors}
        title="Document is currently unavailable."
        sub="It may have been removed, or your connection dropped"
        onRetry={() => { setPhase('idle'); openFile(); }}
      />
    );
  }

  return (
    <Pressable
      onPress={phase === 'idle' ? openFile : undefined}
      style={({ pressed }) => [S.card, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}
      android_ripple={{ color: colors.divider }}
      accessibilityRole="button"
      accessibilityLabel={`Open ${isPdf ? 'PDF' : 'file'}: ${name}`}
    >
      <View style={[S.favicon, { backgroundColor: isPdf ? 'rgba(239,68,68,0.12)' : (colors.iconChipBg || colors.divider) }]}>
        <Ionicons
          name={isPdf ? 'document-text' : isImage ? 'image-outline' : 'document-outline'}
          size={18}
          color={isPdf ? '#ef4444' : colors.textMuted}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[S.cardTitle, { color: colors.text }]} numberOfLines={1}>{name}</Text>
        <Text style={[S.cardSub, { color: colors.textDim }]} numberOfLines={1}>
          {isPdf ? 'PDF' : (file.type || 'file').toUpperCase()}{size ? ` · ${size}` : ''}
          {phase === 'downloading' ? ` · ${Math.round(progress * 100)}%` : ''}
        </Text>
        {phase === 'downloading' ? (
          <View style={[S.progressTrack, { backgroundColor: colors.divider }]}>
            <View style={[S.progressFill, { backgroundColor: colors.accent, width: `${Math.max(4, Math.round(progress * 100))}%` }]} />
          </View>
        ) : null}
      </View>

      {phase === 'downloading'
        ? <ActivityIndicator size="small" color={colors.accent} />
        : <Ionicons name="open-outline" size={16} color={colors.textDim} />}
    </Pressable>
  );
};

// `bottomOffset` — height of chrome overlaying the bottom of the screen
// (the absolute-positioned tab bar on Home/ReelsFeed surfaces). The sheet is
// NOT a Modal: it renders inside the screen subtree, and the tab navigator
// paints its bar ON TOP of screen content, so without this offset the last
// evidence card sits permanently behind the tab bar. Screens without a tab
// bar (e.g. root-stack VideoPlayer) simply omit it.
export default function VideoInfoPanel({ visible, onClose, video, bottomOffset = 0 }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const slideY = useRef(new Animated.Value(height)).current;

  // Lightweight toast inside the sheet ("Link copied.", open failures…).
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);
  const toast = useCallback((msg) => {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

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

  // Scroll padding: when the sheet sits above a tab bar (bottomOffset > 0) the
  // bar already covers the gesture area, so a small breathing pad suffices;
  // otherwise clear the Android gesture/navigation bar via the safe-area inset.
  const scrollBottomPad = bottomOffset > 0 ? 24 : Math.max(insets.bottom, 16) + 28;

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
          bottom: bottomOffset,
          // Lifting the sheet must not push its top edge under the status
          // bar/notch — shrink the cap by the same offset.
          maxHeight: height * 0.85 - bottomOffset,
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
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={[S.iconBtn, { backgroundColor: colors.iconChipBg || colors.surface }]}
            android_ripple={{ color: colors.divider, borderless: true, radius: 22 }}
            accessibilityRole="button"
            accessibilityLabel="Close video details"
          >
            <Ionicons name="close" size={19} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={[S.divider, { backgroundColor: colors.divider }]} />

        <ScrollView
          contentContainerStyle={{ padding: 18, paddingTop: 14, paddingBottom: scrollBottomPad }}
          showsVerticalScrollIndicator={false}
        >
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
                <EvidenceLinkCard rawUrl={video.sourceUrl} colors={colors} toast={toast} />
              ) : null}
              {(video.sourceFiles || []).map((f, i) => (
                <FileCard
                  key={`${f.publicId || f.url}-${i}`}
                  file={f} videoId={video._id} field="source" index={i}
                  colors={colors} toast={toast}
                />
              ))}
            </Section>
          ) : null}

          {/* ── NEWS: Publisher / Source / Related Coverage ───────────────── */}
          {hasNewsSource ? (
            <Section title="News Source" colors={colors}>
              {video.newsPublisher ? (
                <View style={[S.card, { backgroundColor: colors.surface }]}>
                  <View style={[S.favicon, { backgroundColor: colors.iconChipBg || colors.divider }]}>
                    <Ionicons name="business-outline" size={16} color={colors.textMuted} />
                  </View>
                  <Text style={[S.cardTitle, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                    {video.newsPublisher}
                  </Text>
                </View>
              ) : null}
              {video.newsUrl ? (
                <EvidenceLinkCard rawUrl={video.newsUrl} colors={colors} toast={toast} />
              ) : null}
              {(video.newsFiles || []).map((f, i) => (
                <FileCard
                  key={`${f.publicId || f.url}-${i}`}
                  file={f} videoId={video._id} field="news" index={i}
                  colors={colors} toast={toast}
                />
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
                    <EvidenceLinkCard rawUrl={item.url} colors={colors} toast={toast} />
                  )}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                />
              ) : (
                <View style={[S.emptyRelated, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                  <Ionicons name="git-network-outline" size={18} color={colors.textDim} />
                  <Text style={[S.cardSub, { color: colors.textDim, flex: 1 }]}>
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

        {/* Toast — floats above the safe area inside the sheet */}
        {toastMsg ? (
          <View style={[S.toastWrap, { bottom: bottomOffset > 0 ? 18 : Math.max(insets.bottom, 16) + 10 }]} pointerEvents="none">
            <View style={S.toast}>
              <Ionicons name="checkmark-circle" size={15} color="#4ade80" />
              <Text style={S.toastText}>{toastMsg}</Text>
            </View>
          </View>
        ) : null}
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

// ── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 50,
  },
  sheet: {
    position: 'absolute', left: 0, right: 0,
    // `bottom` + `maxHeight` injected at render time (tab-bar offset).
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    zIndex: 100,
    overflow: 'hidden',
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

  // Evidence / file cards — 48dp+ touch target, rounded, modern spacing.
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 11,
    minHeight: 56,
    borderRadius: 14,
    overflow: 'hidden',
  },
  favicon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 13.5, fontWeight: '700' },
  cardSub:   { fontSize: 11.5, marginTop: 2 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },

  progressTrack: { height: 3, borderRadius: 2, marginTop: 7, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 2 },

  emptyRelated: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },

  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 14,
  },
  disclaimerText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },

  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(17,24,39,0.95)',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 22,
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
