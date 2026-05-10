// truevision/screens/HelpSupportScreen.js
//
// Help & Support — list of resources with version footer.

import { Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons }          from '@expo/vector-icons';
import { useTheme }          from '../context/ThemeContext';

const APP_VERSION = '1.0.0';

const Row = ({ icon, label, sub, onPress, last }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.6} style={[S.row, !last && S.rowDivider]}>
    <View style={S.iconWrap}>
      <Ionicons name={icon} size={20} color="#0f172a" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={S.label}>{label}</Text>
      {sub ? <Text style={S.sub}>{sub}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
  </TouchableOpacity>
);

export default function HelpSupportScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const stub = (label) => Alert.alert(label, 'Coming soon.');
  const openMail = () => {
    Linking.openURL('mailto:support@truevision.app?subject=TrueVision support')
      .catch(() => stub('Contact Us'));
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />

      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#0f172a" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Help & Support</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
        <View style={S.card}>
          <Row
            icon="help-buoy-outline"
            label="Help Center"
            sub="Get help with common issues"
            onPress={() => stub('Help Center')}
          />
          <Row
            icon="mail-outline"
            label="Contact Us"
            sub="Send us a message"
            onPress={openMail}
          />
          <Row
            icon="alert-circle-outline"
            label="Report a Problem"
            sub="Let us know what went wrong"
            onPress={() => stub('Report a Problem')}
          />
          <Row
            icon="document-text-outline"
            label="Terms & Conditions"
            onPress={() => stub('Terms & Conditions')}
          />
          <Row
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => stub('Privacy Policy')}
            last
          />
        </View>

        <Text style={S.versionText}>TrueVision v{APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },

  scroll: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 40 },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0',
  },

  iconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  label: { fontSize: 14.5, fontWeight: '700', color: '#0f172a' },
  sub:   { fontSize: 12.5, color: '#64748b', marginTop: 2 },

  versionText: {
    textAlign: 'center', color: '#94a3b8',
    fontSize: 13, fontWeight: '600', marginTop: 26,
  },
});
