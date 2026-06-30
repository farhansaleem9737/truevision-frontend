// truevision/components/activity/ConfirmationModal.js
//
// Reusable themed confirmation modal. Used by Watch History for "Clear all"
// and "Delete selected" — replaces the plain Alert.alert so we control the
// look + behaviour. Themed via useTheme(); supports a destructive primary
// action.

import { Modal, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function ConfirmationModal({
  visible,
  title,
  message,
  icon = 'trash-outline',
  confirmLabel = 'Delete',
  cancelLabel  = 'Cancel',
  destructive  = true,
  onConfirm,
  onCancel,
}) {
  const { colors } = useTheme();

  const primaryBg = destructive ? colors.danger : colors.accent;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={S.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[S.card, { backgroundColor: colors.card }]}>
              <View style={[S.iconWrap, { backgroundColor: destructive ? colors.iconChipDanger : colors.iconChipBg }]}>
                <Ionicons name={icon} size={26} color={destructive ? colors.danger : colors.accent} />
              </View>

              <Text style={[S.title, { color: colors.text }]}>{title}</Text>
              {message ? (
                <Text style={[S.message, { color: colors.textMuted }]}>{message}</Text>
              ) : null}

              <View style={S.btnRow}>
                <Pressable
                  onPress={onCancel}
                  style={[S.btn, { backgroundColor: colors.surface }]}
                >
                  <Text style={[S.btnText, { color: colors.textMuted }]}>{cancelLabel}</Text>
                </Pressable>
                <Pressable
                  onPress={onConfirm}
                  style={[S.btn, { backgroundColor: primaryBg }]}
                >
                  <Text style={[S.btnText, { color: '#fff', fontWeight: '800' }]}>{confirmLabel}</Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%', maxWidth: 420,
    borderRadius: 20,
    paddingHorizontal: 22, paddingTop: 24, paddingBottom: 18,
    alignItems: 'center',
    shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  title:   { fontSize: 17, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  message: { fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginBottom: 18 },

  btnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { fontSize: 14.5, fontWeight: '700' },
});
