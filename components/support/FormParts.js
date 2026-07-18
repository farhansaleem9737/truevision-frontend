// truevision/components/support/FormParts.js
//
// Shared building blocks for the Contact and Report forms: labeled inputs,
// a category chip picker, an auto-diagnostics card, and an attachment tile
// with upload progress. Keeps both forms consistent and DRY.

import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { diagnosticsRows } from '../../utils/diagnostics';

export const Label = ({ children, colors, required }) => (
  <Text style={[S.label, { color: colors.textMuted }]}>
    {children}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}
  </Text>
);

export const LabeledInput = ({ label, required, colors, style, ...props }) => (
  <View style={S.field}>
    {label ? <Label colors={colors} required={required}>{label}</Label> : null}
    <TextInput
      placeholderTextColor={colors.textDim}
      style={[
        S.input,
        { backgroundColor: colors.card, color: colors.text, borderColor: colors.divider },
        props.multiline && S.multiline,
        style,
      ]}
      {...props}
    />
  </View>
);

export const CategoryChips = ({ value, onChange, categories, colors }) => (
  <View style={S.field}>
    <Label colors={colors}>Category</Label>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {categories.map((c) => {
        const active = value === c.key;
        return (
          <TouchableOpacity
            key={c.key}
            onPress={() => onChange(c.key)}
            activeOpacity={0.7}
            style={[S.chip, { backgroundColor: active ? colors.accent : colors.card, borderColor: active ? colors.accent : colors.divider }]}
          >
            <Text style={[S.chipText, { color: active ? '#fff' : colors.textMuted }]}>{c.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
);

export const DiagnosticsCard = ({ net, colors }) => {
  const rows = diagnosticsRows(net);
  return (
    <View style={S.field}>
      <Label colors={colors}>Included automatically</Label>
      <View style={[S.diag, { backgroundColor: colors.card, borderColor: colors.divider }]}>
        {rows.map((r, i) => (
          <View key={r.label} style={[S.diagRow, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }]}>
            <Text style={[S.diagLabel, { color: colors.textMuted }]}>{r.label}</Text>
            <Text style={[S.diagValue, { color: colors.text }]} numberOfLines={1}>{r.value || '—'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// One attachment: an add button when empty, a preview + progress + remove when set.
export const AttachmentTile = ({ label, icon, attachment, progress, uploading, onPick, onRemove, colors }) => {
  const isVideo = attachment?.resourceType === 'video';
  return (
    <View style={S.field}>
      <Label colors={colors}>{label}</Label>
      {attachment ? (
        <View style={[S.attach, { backgroundColor: colors.card, borderColor: colors.divider }]}>
          {attachment.resourceType === 'image'
            ? <ExpoImage source={{ uri: attachment.url }} style={S.thumb} contentFit="cover" />
            : <View style={[S.thumb, S.thumbIcon, { backgroundColor: colors.iconChipBg }]}><Ionicons name={isVideo ? 'videocam' : 'document'} size={22} color={colors.textMuted} /></View>}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[S.attachName, { color: colors.text }]} numberOfLines={1}>{attachment.name || 'Attachment'}</Text>
            <Text style={[S.attachMeta, { color: colors.textDim }]}>{uploading ? `Uploading… ${progress}%` : 'Uploaded'}</Text>
            {uploading && (
              <View style={[S.progressTrack, { backgroundColor: colors.iconChipBg }]}>
                <View style={[S.progressFill, { backgroundColor: colors.accent, width: `${progress}%` }]} />
              </View>
            )}
          </View>
          {!uploading && (
            <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={22} color={colors.textDim} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          onPress={onPick}
          disabled={uploading}
          activeOpacity={0.7}
          style={[S.addBtn, { borderColor: colors.divider, backgroundColor: colors.card }]}
        >
          {uploading
            ? <><View style={[S.progressTrack, { flex: 1, backgroundColor: colors.iconChipBg }]}><View style={[S.progressFill, { backgroundColor: colors.accent, width: `${progress}%` }]} /></View><Text style={[S.addText, { color: colors.textMuted, marginLeft: 10 }]}>{progress}%</Text></>
            : <><Ionicons name={icon} size={20} color={colors.accent} /><Text style={[S.addText, { color: colors.textMuted }]}>{label}</Text></>}
        </TouchableOpacity>
      )}
    </View>
  );
};

const S = StyleSheet.create({
  field: { marginTop: 18 },
  label: { fontSize: 12.5, fontWeight: '700', marginBottom: 8, marginLeft: 2 },
  input: {
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, minHeight: 46,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 },

  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 13, fontWeight: '600' },

  diag: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  diagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  diagLabel: { fontSize: 13 },
  diagValue: { fontSize: 13, fontWeight: '600', maxWidth: '60%' },

  attach: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
  attachName: { fontSize: 14, fontWeight: '600' },
  attachMeta: { fontSize: 12, marginTop: 2 },
  progressTrack: { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 50, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed',
  },
  addText: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
});
