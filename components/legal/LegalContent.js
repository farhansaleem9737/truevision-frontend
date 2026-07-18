// truevision/components/legal/LegalContent.js
//
// Renders the typed block array used by the legal documents (see
// Backend/data/legal.js): paragraphs, bullet lists, and inline links. Shared
// by the Terms and Privacy screens so both format identically.

import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const openUrl = (url) => Linking.openURL(url).catch(() => {});

export default function LegalContent({ blocks = [], colors }) {
  return (
    <View>
      {blocks.map((block, i) => {
        if (block.type === 'list') {
          return (
            <View key={i} style={S.list}>
              {(block.items || []).map((item, j) => (
                <View key={j} style={S.listItem}>
                  <View style={[S.bullet, { backgroundColor: colors.accent }]} />
                  <Text style={[S.listText, { color: colors.textMuted }]}>{item}</Text>
                </View>
              ))}
            </View>
          );
        }
        if (block.type === 'link') {
          return (
            <TouchableOpacity key={i} style={S.link} onPress={() => openUrl(block.url)} activeOpacity={0.7}>
              <Ionicons name="open-outline" size={15} color={colors.accent} />
              <Text style={[S.linkText, { color: colors.accent }]}>{block.label || block.url}</Text>
            </TouchableOpacity>
          );
        }
        // default: paragraph
        return (
          <Text key={i} style={[S.paragraph, { color: colors.textMuted }]}>
            {block.text}
          </Text>
        );
      })}
    </View>
  );
}

const S = StyleSheet.create({
  paragraph: { fontSize: 14, lineHeight: 22, marginBottom: 10 },
  list: { marginBottom: 8 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8, marginRight: 10 },
  listText: { flex: 1, fontSize: 14, lineHeight: 21 },
  link: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  linkText: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
});
