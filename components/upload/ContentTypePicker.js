// truevision/components/upload/ContentTypePicker.js
//
// Single-select picker for the three content types: Fact / News / Opinion.
// Used by the Upload screen above the Source section. Stays out of the
// existing styling — uses the same neutral palette as the rest of the form.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Order matters — it's the visual order in the picker.
const TYPES = [
  {
    id:    'fact',
    label: 'Fact',
    icon:  'checkmark-circle-outline',
    desc:  'Verified or evidence-based information.',
  },
  {
    id:    'news',
    label: 'News',
    icon:  'newspaper-outline',
    desc:  'Current event, report, or recent development.',
  },
  {
    id:    'opinion',
    label: 'Opinion',
    icon:  'chatbubble-ellipses-outline',
    desc:  'Personal analysis or viewpoint.',
  },
];

export default function ContentTypePicker({ value, onChange }) {
  return (
    <View style={S.wrap}>
      {TYPES.map((t) => {
        const selected = value === t.id;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(selected ? null : t.id)}
            style={({ pressed }) => [
              S.card,
              selected && S.cardSelected,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={[S.iconWrap, selected && S.iconWrapSelected]}>
              <Ionicons
                name={t.icon}
                size={20}
                color={selected ? '#fff' : '#475569'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[S.label, selected && S.labelSelected]}>{t.label}</Text>
              <Text style={S.desc}>{t.desc}</Text>
            </View>
            {selected ? (
              <Ionicons name="checkmark-circle" size={20} color="#0f172a" />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { gap: 10 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb',
    gap: 12,
  },
  cardSelected: {
    borderColor: '#0f172a',
    backgroundColor: '#f8fafc',
  },

  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapSelected: { backgroundColor: '#0f172a' },

  label:         { fontSize: 14.5, fontWeight: '700', color: '#0f172a' },
  labelSelected: { color: '#0f172a' },
  desc:          { fontSize: 12.5, color: '#64748b', marginTop: 2 },
});
