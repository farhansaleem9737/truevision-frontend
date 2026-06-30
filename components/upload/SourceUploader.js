// truevision/components/upload/SourceUploader.js
//
// Reusable "attach supporting files + paste URL" block. Used by the Upload
// screen for both FACT (Supporting Evidence) and NEWS (News Source) sections.
//
// Props:
//   title        — section header (e.g. "Supporting Evidence (Optional)")
//   files        — current file array  [{ url, publicId, type, name, size }]
//   onChangeFiles(files)
//   url          — current url string (optional)
//   onChangeUrl(text)
//   urlLabel     — placeholder for the URL field
//   extraField   — optional ReactNode rendered above the URL field (used by
//                  News section for the "Publisher name" input)
//
// File uploads go straight to Cloudinary via videoService.uploadAttachment().
// While a file is uploading we show its name + a small spinner; on success it
// becomes a removable chip with the icon (image / pdf / document).

import { useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import videoService from '../../services/VideoService';

const MAX_FILES = 5;

// Lazy-require expo-document-picker so this component still loads in
// environments where the package hasn't been installed yet — picking a doc
// will simply show an Alert in that case.
let DocumentPicker = null;
try { DocumentPicker = require('expo-document-picker'); } catch (_) { /* optional */ }

const fileTypeIcon = (type) => {
  if (type === 'image') return 'image';
  if (type === 'pdf')   return 'document-text';
  return 'document';
};

export default function SourceUploader({
  title,
  files = [],
  onChangeFiles,
  url = '',
  onChangeUrl,
  urlLabel = 'Paste source URL (optional)',
  extraField = null,
}) {
  const [uploading, setUploading] = useState(false);

  const canAddMore = files.length < MAX_FILES;

  const append = (file) => onChangeFiles?.([...files, file]);
  const removeAt = (idx) => {
    const next = files.slice();
    next.splice(idx, 1);
    onChangeFiles?.(next);
  };

  const pickImage = async () => {
    if (!canAddMore) {
      Alert.alert('Limit reached', `You can attach up to ${MAX_FILES} files.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ['images'],
      allowsEditing: false,
      quality:       0.9,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setUploading(true);
    const up = await videoService.uploadAttachment(asset.uri, {
      name:     asset.fileName || `image-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
      size:     asset.fileSize || 0,
    });
    setUploading(false);

    if (up.success) {
      append({
        url:      up.url,
        publicId: up.publicId,
        type:     'image',
        name:     up.name,
        size:     up.size,
      });
    } else {
      Alert.alert('Upload failed', up.message || 'Could not upload image.');
    }
  };

  const pickDocument = async () => {
    if (!canAddMore) {
      Alert.alert('Limit reached', `You can attach up to ${MAX_FILES} files.`);
      return;
    }
    if (!DocumentPicker) {
      Alert.alert(
        'Document picker missing',
        'Run "npm install expo-document-picker" and restart Metro to enable file attachments.',
      );
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/*'],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setUploading(true);
    const up = await videoService.uploadAttachment(asset.uri, {
      name:     asset.name || `document-${Date.now()}`,
      mimeType: asset.mimeType || 'application/octet-stream',
      size:     asset.size || 0,
    });
    setUploading(false);

    if (up.success) {
      append(up);
    } else {
      Alert.alert('Upload failed', up.message || 'Could not upload document.');
    }
  };

  return (
    <View style={S.wrap}>
      <Text style={S.title}>{title}</Text>

      {extraField}

      {/* URL field */}
      <View style={S.urlRow}>
        <Ionicons name="link-outline" size={16} color="#64748b" style={{ marginRight: 8 }} />
        <TextInput
          value={url}
          onChangeText={onChangeUrl}
          placeholder={urlLabel}
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={S.urlInput}
        />
      </View>

      {/* Attached files */}
      {files.length > 0 ? (
        <View style={{ marginTop: 10, gap: 8 }}>
          {files.map((f, idx) => (
            <View key={`${f.publicId || f.url}-${idx}`} style={S.fileRow}>
              <Ionicons name={fileTypeIcon(f.type)} size={16} color="#475569" />
              <Text style={S.fileName} numberOfLines={1}>{f.name || f.url}</Text>
              <Pressable onPress={() => removeAt(idx)} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* Pick buttons */}
      <View style={S.btnRow}>
        <Pressable
          style={({ pressed }) => [S.btn, pressed && { opacity: 0.85 }]}
          onPress={pickImage}
          disabled={uploading}
        >
          <Ionicons name="image-outline" size={16} color="#0f172a" />
          <Text style={S.btnText}>Image</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [S.btn, pressed && { opacity: 0.85 }]}
          onPress={pickDocument}
          disabled={uploading}
        >
          <Ionicons name="document-attach-outline" size={16} color="#0f172a" />
          <Text style={S.btnText}>PDF / Doc</Text>
        </Pressable>

        {uploading ? (
          <View style={S.uploading}>
            <ActivityIndicator size="small" color="#0f172a" />
            <Text style={S.uploadingText}>Uploading…</Text>
          </View>
        ) : null}
      </View>

      <Text style={S.hint}>
        Up to {MAX_FILES} attachments. PDFs, images, or docs are accepted. Sources help build trust but are not required.
      </Text>
    </View>
  );
}

const S = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb',
    padding: 14,
    gap: 10,
  },
  title: { fontSize: 14, fontWeight: '700', color: '#0f172a' },

  urlRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  urlInput: { flex: 1, fontSize: 13.5, color: '#0f172a', padding: 0 },

  fileRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    gap: 8,
  },
  fileName: { flex: 1, fontSize: 13, color: '#0f172a', fontWeight: '600' },

  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
  },
  btnText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },

  uploading: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  uploadingText: { fontSize: 12, color: '#64748b' },

  hint: { fontSize: 11.5, color: '#94a3b8', marginTop: 2 },
});
