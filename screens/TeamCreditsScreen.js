// truevision/screens/TeamCreditsScreen.js
//
// Team & Credits: developers, contributors, acknowledgements and clickable
// GitHub / website links. The "libraries used" count is derived from the
// auto-generated assets/licenses.json, with a shortcut into the full licenses
// screen — so this screen never hand-maintains a library list.

import { Linking, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { DEVELOPERS, CONTRIBUTORS, ACKNOWLEDGEMENTS, PRODUCT } from '../constants/credits';
import licensesData from '../assets/licenses.json';

const open = (url) => url && Linking.openURL(url).catch(() => {});

const LinkChip = ({ icon, label, url, colors }) => (
  <TouchableOpacity style={[S.chip, { backgroundColor: colors.iconChipBg }]} onPress={() => open(url)} activeOpacity={0.7}>
    <Ionicons name={icon} size={14} color={colors.text} />
    <Text style={[S.chipText, { color: colors.text }]}>{label}</Text>
  </TouchableOpacity>
);

const SectionTitle = ({ children, colors }) => (
  <Text style={[S.sectionTitle, { color: colors.textMuted }]}>{children}</Text>
);

export default function TeamCreditsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const libCount = licensesData?.count || licensesData?.libraries?.length || 0;

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Team & Credits" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Developers */}
        <View style={S.block}>
          <SectionTitle colors={colors}>Developers</SectionTitle>
          <View style={[S.card, { backgroundColor: colors.card }]}>
            {DEVELOPERS.map((d, i) => (
              <View key={d.name} style={[S.person, i < DEVELOPERS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }]}>
                <View style={[S.avatar, { backgroundColor: colors.iconChipBg }]}>
                  <Ionicons name="person" size={18} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.personName, { color: colors.text }]}>{d.name}</Text>
                  {d.role ? <Text style={[S.personRole, { color: colors.textMuted }]}>{d.role}</Text> : null}
                  <View style={S.chipRow}>
                    {d.github ? <LinkChip icon="logo-github" label="GitHub" url={d.github} colors={colors} /> : null}
                    {d.website ? <LinkChip icon="globe-outline" label="Website" url={d.website} colors={colors} /> : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Contributors */}
        {CONTRIBUTORS.length > 0 && (
          <View style={S.block}>
            <SectionTitle colors={colors}>Contributors</SectionTitle>
            <View style={[S.card, { backgroundColor: colors.card }]}>
              {CONTRIBUTORS.map((c, i) => (
                <View key={c.name} style={[S.person, i < CONTRIBUTORS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }]}>
                  <View style={[S.avatar, { backgroundColor: colors.iconChipBg }]}>
                    <Ionicons name="people" size={18} color={colors.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.personName, { color: colors.text }]}>{c.name}</Text>
                    {c.role ? <Text style={[S.personRole, { color: colors.textMuted }]}>{c.role}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Libraries */}
        <View style={S.block}>
          <SectionTitle colors={colors}>Libraries</SectionTitle>
          <TouchableOpacity
            style={[S.card, S.libRow, { backgroundColor: colors.card }]}
            onPress={() => navigation.navigate('Licenses')}
            activeOpacity={0.7}
          >
            <View style={[S.avatar, { backgroundColor: colors.iconChipBg }]}>
              <Ionicons name="cube-outline" size={18} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[S.personName, { color: colors.text }]}>Built with {libCount} open-source libraries</Text>
              <Text style={[S.personRole, { color: colors.textMuted }]}>View open source licenses</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </TouchableOpacity>
        </View>

        {/* Acknowledgements */}
        <View style={S.block}>
          <SectionTitle colors={colors}>Acknowledgements</SectionTitle>
          <View style={[S.card, { backgroundColor: colors.card, padding: 16 }]}>
            {ACKNOWLEDGEMENTS.map((a, i) => (
              <View key={i} style={S.ackRow}>
                <View style={[S.bullet, { backgroundColor: colors.accent }]} />
                <Text style={[S.ackText, { color: colors.textMuted }]}>{a}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Product links */}
        <View style={[S.chipRow, S.productLinks]}>
          <LinkChip icon="globe-outline" label={PRODUCT.website.replace(/^https?:\/\//, '')} url={PRODUCT.website} colors={colors} />
          <LinkChip icon="logo-github" label="GitHub" url={PRODUCT.github} colors={colors} />
        </View>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  block: { paddingHorizontal: 16, paddingTop: 22 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 },
  card: { borderRadius: 14, overflow: 'hidden' },

  person: { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  personName: { fontSize: 15, fontWeight: '700' },
  personRole: { fontSize: 13, marginTop: 2 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 8, marginTop: 4 },
  chipText: { fontSize: 12, fontWeight: '600', marginLeft: 6 },

  libRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },

  ackRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7, marginRight: 10 },
  ackText: { flex: 1, fontSize: 14, lineHeight: 21 },

  productLinks: { paddingHorizontal: 16, marginTop: 24, justifyContent: 'center' },
});
