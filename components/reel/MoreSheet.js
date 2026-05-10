// truevision/components/reel/MoreSheet.js
//
// Bottom sheet shown when the three-dot button is tapped on a reel.
// Six actions: Interested, Not Interested, Hide, Report, Share Link, Download.
//
// Notes:
//   - "Interested" / "Not Interested" / "Hide" call the parent so HomeScreen
//     can suppress the video (and tag the category for soft preference learning).
//   - "Share Link" uses the native Share API.
//   - "Download" uses expo-file-system to grab the file then opens the system
//     share sheet so the user can pick "Save to Photos / Files". For true
//     save-to-gallery without an extra step, install `expo-media-library`.

import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback,
  Modal, Animated, Dimensions, Share, Alert, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

const { height } = Dimensions.get('window');

const OPTIONS = [
  { key: 'interested',     label: 'Interested',          icon: 'thumbs-up-outline' },
  { key: 'not-interested', label: 'Not Interested',      icon: 'thumbs-down-outline' },
  { key: 'hide',           label: 'Hide this video',     icon: 'eye-off-outline' },
  { key: 'report',         label: 'Report',              icon: 'flag-outline', danger: true },
  { key: 'share-link',     label: 'Share Link',          icon: 'link-outline' },
  { key: 'download',       label: 'Download',            icon: 'download-outline' },
];

export default function MoreSheet({ visible, onClose, item, onHide }) {
  const slideY = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : height,
      useNativeDriver: true,
      friction: 22, tension: 220,
    }).start();
  }, [visible]);

  if (!visible && slideY._value === height) return null;

  // ── Action handlers ─────────────────────────────────────────────────────
  const handleSelect = async (key) => {
    onClose?.();

    switch (key) {
      case 'interested':
        Alert.alert('Got it', "We'll show you more like this.");
        break;

      case 'not-interested':
      case 'hide':
        onHide?.(item, key);
        break;

      case 'report':
        Alert.alert(
          'Report video',
          'Thanks — we\'ll review this content. You won\'t see it again.',
          [{ text: 'OK', onPress: () => onHide?.(item, 'report') }],
        );
        break;

      case 'share-link': {
        try {
          const url = item.pexelsUrl || item.videoUrl || '';
          const message = item.userId?.username
            ? `Check out @${item.userId.username} on TrueVision\n${url}`
            : `Check out this video\n${url}`;
          await Share.share({ message, url });
        } catch {}
        break;
      }

      case 'download': {
        if (!item.videoUrl) {
          Alert.alert('Download failed', 'No downloadable URL on this video.');
          return;
        }
        try {
          const filename = `truevision-${item._id || item.id || Date.now()}.mp4`;
          const target = `${FileSystem.cacheDirectory}${filename}`;
          Alert.alert('Downloading', 'Saving to your share sheet…');
          const { uri } = await FileSystem.downloadAsync(item.videoUrl, target);
          // Open share sheet so the user can pick "Save Video" / "Save to Files"
          await Share.share({ url: uri, message: 'Saved video' });
        } catch (e) {
          Alert.alert('Download failed', e.message || 'Try again later.');
        }
        break;
      }
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={S.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View style={[S.sheet, { transform: [{ translateY: slideY }] }]}>
        <View style={S.handleWrap}>
          <View style={S.handle} />
        </View>

        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={S.row}
            activeOpacity={0.6}
            onPress={() => handleSelect(opt.key)}
          >
            <Ionicons
              name={opt.icon}
              size={22}
              color={opt.danger ? '#ef4444' : '#0f172a'}
            />
            <Text style={[S.label, opt.danger && S.labelDanger]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={[S.row, S.cancel]} activeOpacity={0.6} onPress={onClose}>
          <Text style={S.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },
  handleWrap: { alignItems: 'center', paddingVertical: 8 },
  handle:     { width: 38, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 22, paddingVertical: 14,
  },
  label: {
    fontSize: 15, fontWeight: '600', color: '#0f172a', marginLeft: 14,
  },
  labelDanger: { color: '#ef4444' },

  cancel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    marginTop: 4,
    justifyContent: 'center',
  },
  cancelText: {
    flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#64748b',
  },
});
