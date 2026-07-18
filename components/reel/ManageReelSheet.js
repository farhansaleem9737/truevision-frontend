// truevision/components/reel/ManageReelSheet.js
//
// The Instagram-style "Manage your reel" bottom sheet, shown when the OWNER
// of a video taps the three-dot menu on their own reel/video card. Do NOT
// render this sheet for other users' videos — the caller must gate on
// isOwner and open a viewer-facing MoreSheet instead.
//
// Design
// • BlurView over a fading dark backdrop, spring slide-up + fade-in.
// • Theme-aware (dark + light) via ThemeContext.
// • Nine actions with subtle icon chips; toggles show their live state.
// • Delete uses an inline confirmation step inside the same sheet so we
//   avoid Alert.alert() and give the user a clean "Keep / Delete" prompt.
// • All network calls are the caller's responsibility — this component
//   only fires the corresponding on…() callback with { videoId }.
//
// Contract (props)
//   visible          boolean          — controls open/close
//   onClose          () => void
//   video            {
//     _id, id,       string
//     allowComments  boolean
//     allowDownload  boolean
//     pinned         boolean
//     hideLikeCount  boolean
//     hideShareCount boolean
//     isArchived     boolean
//   }
//   onEdit           (video) => void  — navigate to EditReelScreen
//   onToggleComments (video) => Promise<{ allowComments }>
//   onToggleDownload (video) => Promise<{ allowDownload }>
//   onTogglePin      (video) => Promise<{ pinned }>
//   onToggleHideLikeCount   (video) => Promise<{ hideLikeCount }>
//   onToggleHideShareCount  (video) => Promise<{ hideShareCount }>
//   onDownload       (video) => void  — download the media file
//   onToggleArchive  (video) => Promise<{ isArchived }>
//   onDelete         (video) => void  — video removed permanently
//
// Each toggle callback should mutate its persistent state and return the
// new boolean so this sheet can rerender in place; the parent may also
// choose to close+reopen the sheet with the fresh video prop.

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, TouchableWithoutFeedback,
  Modal, Animated, Dimensions, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';

const { height: SCREEN_H } = Dimensions.get('window');

export default function ManageReelSheet({
  visible,
  onClose,
  video,
  onEdit,
  onToggleComments,
  onToggleDownload,
  onTogglePin,
  onToggleHideLikeCount,
  onToggleHideShareCount,
  onDownload,
  onToggleArchive,
  onDelete,
}) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const fade   = useRef(new Animated.Value(0)).current;

  const [mounted, setMounted]         = useState(visible);
  const [confirmDelete, setConfirm]   = useState(false);
  // Track which row is currently mid-request so we can show a spinner and
  // debounce double-taps. Only one action can be in-flight at a time.
  const [busyKey, setBusyKey]         = useState(null);

  // Local mirror of the toggle flags — lets the row label update the
  // instant the API returns without waiting for the parent to re-render.
  const [state, setState] = useState({
    allowComments:  true,
    allowDownload:  true,
    pinned:         false,
    hideLikeCount:  false,
    hideShareCount: false,
    isArchived:     false,
  });

  // Re-sync the local mirror ONLY when a different video is loaded into the
  // sheet or when it (re)opens — NOT on every parent re-render. Keying on
  // the whole `video` object would fire on each render (parents often pass
  // a fresh merged literal) and could overwrite an in-flight optimistic
  // toggle with stale values.
  const videoKey = video?._id || video?.id || null;
  useEffect(() => {
    if (video && visible) {
      setState({
        allowComments:  !!video.allowComments,
        allowDownload:  !!video.allowDownload,
        pinned:         !!video.pinned,
        hideLikeCount:  !!video.hideLikeCount,
        hideShareCount: !!video.hideShareCount,
        isArchived:     !!video.isArchived,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoKey, visible]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setConfirm(false);
      setBusyKey(null);
      Haptics.selectionAsync().catch(() => {});
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0, useNativeDriver: true, friction: 22, tension: 220,
        }),
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
        Animated.timing(fade,   { toValue: 0,        duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible, slideY, fade]);

  if (!mounted) return null;

  const palette = isDark ? DARK : LIGHT;

  // ── Shared toggle wrapper ────────────────────────────────────────────────
  // Guards against double-taps, sets busyKey while the promise pends, applies
  // the returned boolean to the local mirror, and shows haptic on success.
  const runToggle = (key, callback, stateKey) => async () => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      const result = await callback?.(video);
      const next   = result && typeof result[stateKey] === 'boolean'
        ? result[stateKey]
        : !state[stateKey];
      setState((s) => ({ ...s, [stateKey]: next }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (_) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setBusyKey(null);
    }
  };

  // Fire-and-forget navigation actions — close the sheet first so the
  // navigation transition doesn't fight the sheet slide-down animation.
  const dismissThen = (fn) => () => {
    onClose?.();
    setTimeout(() => fn?.(video), 60);
  };

  const rows = [
    {
      key:     'edit',
      icon:    'pencil-outline',
      label:   'Edit reel',
      onPress: dismissThen(onEdit),
    },
    {
      key:     'comments',
      icon:    state.allowComments ? 'chatbubble-ellipses-outline' : 'chatbubble-outline',
      label:   state.allowComments ? 'Turn off commenting' : 'Turn on commenting',
      onPress: runToggle('comments', onToggleComments, 'allowComments'),
      strike:  !state.allowComments,
    },
    {
      key:     'download-toggle',
      icon:    'arrow-down-circle-outline',
      label:   state.allowDownload ? 'Turn off downloading' : 'Turn on downloading',
      onPress: runToggle('download-toggle', onToggleDownload, 'allowDownload'),
      strike:  !state.allowDownload,
    },
    {
      key:     'pin',
      icon:    state.pinned ? 'pin' : 'pin-outline',
      label:   state.pinned ? 'Unpin from your reels' : 'Pin to your reels',
      onPress: runToggle('pin', onTogglePin, 'pinned'),
    },
    {
      key:     'hide-like-count',
      icon:    'heart-dislike-outline',
      label:   state.hideLikeCount ? 'Show like count to others' : 'Hide like count from others',
      onPress: runToggle('hide-like-count', onToggleHideLikeCount, 'hideLikeCount'),
    },
    {
      key:     'hide-share-count',
      icon:    'eye-off-outline',
      label:   state.hideShareCount ? 'Show share count to others' : 'Hide share count from others',
      onPress: runToggle('hide-share-count', onToggleHideShareCount, 'hideShareCount'),
    },
    {
      key:     'download',
      icon:    'download-outline',
      label:   'Download',
      onPress: dismissThen(onDownload),
    },
    {
      key:     'archive',
      icon:    state.isArchived ? 'archive' : 'archive-outline',
      label:   state.isArchived ? 'Restore from archive' : 'Archive',
      onPress: runToggle('archive', onToggleArchive, 'isArchived'),
      accent:  state.isArchived ? 'accent' : 'danger', // "restore" reads as positive
    },
    {
      key:     'delete',
      icon:    'trash-outline',
      label:   'Delete reel',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setConfirm(true);
      },
      danger:  true,
    },
  ];

  const confirmDeleteAction = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    onClose?.();
    setTimeout(() => onDelete?.(video), 60);
  };

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[S.backdrop, { opacity: fade }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View
        style={[
          S.sheetWrap,
          {
            paddingBottom: Math.max(insets.bottom, 12) + 8,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 60 : 90}
          tint={isDark ? 'dark' : 'light'}
          style={[
            S.sheet,
            { backgroundColor: palette.sheetBg, borderColor: palette.border },
          ]}
        >
          <View style={[S.handle, { backgroundColor: palette.handle }]} />

          {!confirmDelete ? (
            <>
              <Text style={[S.title, { color: palette.text }]}>Manage your reel</Text>
              <View style={[S.hairline, { backgroundColor: palette.divider }]} />

              <View style={S.list}>
                {rows.map((row, i) => (
                  <View key={row.key}>
                    <ActionRow
                      row={row}
                      palette={palette}
                      busy={busyKey === row.key}
                    />
                    {i < rows.length - 1 ? (
                      <View style={[S.rowDivider, { backgroundColor: palette.divider }]} />
                    ) : null}
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={S.confirmWrap}>
              <View style={[S.confirmIcon, { backgroundColor: palette.dangerSoft }]}>
                <Ionicons name="trash" size={22} color={palette.danger} />
              </View>
              <Text style={[S.confirmTitle, { color: palette.text }]}>
                Delete this reel permanently?
              </Text>
              <Text style={[S.confirmBody, { color: palette.textMuted }]}>
                This removes the video, its comments, likes, saves, and download
                history. It cannot be undone.
              </Text>
              <View style={S.confirmActions}>
                <Pressable
                  onPress={() => setConfirm(false)}
                  style={({ pressed }) => [
                    S.confirmBtn,
                    {
                      backgroundColor: palette.btnNeutralBg,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <Text style={[S.confirmBtnLabel, { color: palette.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmDeleteAction}
                  style={({ pressed }) => [
                    S.confirmBtn,
                    {
                      backgroundColor: palette.danger,
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <Text style={[S.confirmBtnLabel, { color: '#fff' }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

const ActionRow = ({ row, palette, busy }) => {
  const tint = row.danger
    ? palette.danger
    : row.accent === 'accent'
      ? palette.accent
      : palette.text;
  return (
    <Pressable
      onPress={row.onPress}
      android_ripple={{ color: palette.ripple, borderless: false }}
      style={({ pressed }) => [
        S.row,
        Platform.OS === 'ios' && {
          opacity: pressed ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
      disabled={busy}
    >
      <View
        style={[
          S.iconWrap,
          { backgroundColor: row.danger ? palette.dangerSoft : palette.iconChipBg },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={tint} />
        ) : (
          <Ionicons name={row.icon} size={20} color={tint} />
        )}
      </View>
      <Text
        style={[
          S.label,
          { color: tint },
          row.strike && { textDecorationLine: 'line-through', textDecorationColor: palette.textMuted, opacity: 0.9 },
        ]}
      >
        {row.label}
      </Text>
    </Pressable>
  );
};

// ── Palettes ─────────────────────────────────────────────────────────────────
const DARK = {
  sheetBg:       'rgba(20,20,24,0.82)',
  border:        'rgba(255,255,255,0.06)',
  divider:       'rgba(255,255,255,0.06)',
  handle:        'rgba(255,255,255,0.25)',
  text:          '#f5f5f7',
  textMuted:     '#a1a1aa',
  iconChipBg:    'rgba(255,255,255,0.08)',
  ripple:        'rgba(255,255,255,0.08)',
  accent:        '#22C55E',
  danger:        '#ff5a5f',
  dangerSoft:    'rgba(255,90,95,0.15)',
  btnNeutralBg:  'rgba(255,255,255,0.10)',
};

const LIGHT = {
  sheetBg:       'rgba(255,255,255,0.94)',
  border:        'rgba(15,23,42,0.06)',
  divider:       'rgba(15,23,42,0.06)',
  handle:        'rgba(15,23,42,0.18)',
  text:          '#0f172a',
  textMuted:     '#64748b',
  iconChipBg:    '#f1f5f9',
  ripple:        'rgba(15,23,42,0.06)',
  accent:        '#16a34a',
  danger:        '#ef4444',
  dangerSoft:    '#fef2f2',
  btnNeutralBg:  '#f1f5f9',
};

const S = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 10,
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingHorizontal: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.30,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 44, height: 4,
    borderRadius: 2,
    marginTop: 6, marginBottom: 6,
  },
  title: {
    fontSize: 16.5, fontWeight: '700',
    textAlign: 'center',
    paddingTop: 4, paddingBottom: 12,
    letterSpacing: 0.1,
  },
  hairline: { height: StyleSheet.hairlineWidth, marginHorizontal: 4 },

  list: { paddingTop: 4, paddingBottom: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 14,
    borderRadius: 12,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  label: { fontSize: 15.5, fontWeight: '600', letterSpacing: 0.1, flex: 1 },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },

  // Inline delete confirmation
  confirmWrap: {
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4, marginBottom: 14,
  },
  confirmTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  confirmBody:  { fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  confirmActions: {
    flexDirection: 'row', alignSelf: 'stretch', gap: 10,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnLabel: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
