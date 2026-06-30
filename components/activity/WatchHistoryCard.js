// truevision/components/activity/WatchHistoryCard.js
//
// One tile in the Watch History grid. Renders:
//   • Thumbnail with subtle "watched" overlay + progress bar
//   • Duration badge (top-right corner)
//   • Title (two lines)
//   • Relative "watched X ago" timestamp
//   • Either an X remove button (default mode) OR a selection checkmark
//     (multi-select mode).

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDuration = (seconds) => {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `0:${String(s).padStart(2, '0')}`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}:${String(r).padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

const fmtRelative = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)         return 'just now';
  if (diff < 3600)       return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7)  return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400 / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// ── Component ────────────────────────────────────────────────────────────────

export default function WatchHistoryCard({
  item,
  width,
  selectionMode = false,
  selected = false,
  onPress,
  onLongPress,
  onRemove,
}) {
  const { colors } = useTheme();
  const video = item.video || {};

  const relative   = useMemo(() => fmtRelative(item.watchedAt), [item.watchedAt]);
  const durationStr = useMemo(() => fmtDuration(video.duration), [video.duration]);

  // 0-100 → 0-1 for the progress fill
  const completion = Math.max(0, Math.min(100, item.completionPercentage || 0));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[S.wrap, { width }]}
      android_ripple={{ color: 'rgba(0,0,0,0.04)' }}
    >
      {/* Thumbnail with overlays */}
      <View style={[S.thumbBox, { backgroundColor: colors.iconChipBg, width }]}>
        {video.thumbnailUrl ? (
          <ExpoImage
            source={{ uri: video.thumbnailUrl }}
            style={S.thumb}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[S.thumb, S.thumbPlaceholder]}>
            <Ionicons name="videocam-outline" size={22} color={colors.textDim} />
          </View>
        )}

        {/* Duration badge (top-right) */}
        {durationStr ? (
          <View style={S.durationBadge}>
            <Text style={S.durationText}>{durationStr}</Text>
          </View>
        ) : null}

        {/* Watched-progress bar (bottom of thumbnail) */}
        {completion > 0 ? (
          <View style={S.progressTrack}>
            <View style={[S.progressFill, { width: `${completion}%` }]} />
          </View>
        ) : null}

        {/* Selection overlay (multi-select mode) */}
        {selectionMode ? (
          <View style={[S.selectOverlay, selected && { backgroundColor: 'rgba(212,160,23,0.18)' }]} />
        ) : null}

        {/* Top-right control: ✕ remove (default) or ✓ check (select mode) */}
        {selectionMode ? (
          <View style={[S.checkBubble, selected ? S.checkBubbleOn : null]}>
            {selected ? (
              <Ionicons name="checkmark" size={14} color="#fff" />
            ) : null}
          </View>
        ) : (
          <Pressable
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={S.removeBubble}
          >
            <Ionicons name="close" size={14} color="#fff" />
          </Pressable>
        )}
      </View>

      {/* Title (2 lines) */}
      <Text
        style={[S.title, { color: colors.text }]}
        numberOfLines={2}
      >
        {video.title || 'Untitled'}
      </Text>

      {/* Relative watched date */}
      <Text style={[S.meta, { color: colors.textDim }]} numberOfLines={1}>
        Watched {relative}
      </Text>
    </Pressable>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  wrap: { marginBottom: 14 },

  thumbBox: {
    aspectRatio: 9 / 14,           // portrait short-video shape
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },

  durationBadge: {
    position: 'absolute', bottom: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
  },
  durationText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },

  progressTrack: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  progressFill: { height: '100%', backgroundColor: '#D4A017' },

  removeBubble: {
    position: 'absolute', top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  selectOverlay: { ...StyleSheet.absoluteFillObject },
  checkBubble: {
    position: 'absolute', top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  checkBubbleOn: { backgroundColor: '#D4A017', borderColor: '#D4A017' },

  title: { marginTop: 8, fontSize: 12.5, fontWeight: '700', lineHeight: 16 },
  meta:  { marginTop: 2, fontSize: 11.5, fontWeight: '500' },
});
