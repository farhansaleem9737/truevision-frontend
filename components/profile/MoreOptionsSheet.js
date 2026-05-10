// truevision/components/profile/MoreOptionsSheet.js
//
// Bottom sheet shown when the three-dot button is tapped on the Profile header.
// Three actions: Settings, Help & Support, Logout.
//
// Logout opens a confirmation Alert before actually clearing auth state.

import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback,
  Modal, Animated, Dimensions, Alert, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

export default function MoreOptionsSheet({ visible, onClose, onSettings, onHelp, onLogout }) {
  const slideY = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : height,
      useNativeDriver: true,
      friction: 22, tension: 220,
    }).start();
  }, [visible]);

  if (!visible && slideY._value === height) return null;

  const handleLogout = () => {
    onClose?.();
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => onLogout?.() },
      ],
      { cancelable: true },
    );
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
        <View style={S.headerRow}>
          <Text style={S.title}>More options</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#475569" />
          </TouchableOpacity>
        </View>

        <View style={S.list}>
          <Row
            icon="settings-outline"
            label="Settings"
            onPress={() => { onClose?.(); onSettings?.(); }}
          />
          <Row
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => { onClose?.(); onHelp?.(); }}
          />
          <Row
            icon="log-out-outline"
            label="Logout"
            danger
            onPress={handleLogout}
          />
        </View>
      </Animated.View>
    </Modal>
  );
}

const Row = ({ icon, label, onPress, danger }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.6} style={S.row}>
    <View style={[S.iconWrap, danger && S.iconWrapDanger]}>
      <Ionicons name={icon} size={20} color={danger ? '#ef4444' : '#0f172a'} />
    </View>
    <Text style={[S.label, danger && S.labelDanger]}>{label}</Text>
  </TouchableOpacity>
);

const S = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 14, paddingHorizontal: 8,
    paddingBottom: Platform.OS === 'ios' ? 32 : 18,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: -4 },
    elevation: 22,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 10,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#0f172a' },

  list: { paddingTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 14,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  iconWrapDanger: { backgroundColor: '#fef2f2' },
  label: { fontSize: 15.5, fontWeight: '600', color: '#0f172a' },
  labelDanger: { color: '#ef4444' },
});
