// truevision/components/Snackbar.js
//
// Lightweight success/error snackbar with a slide+fade animation and
// auto-dismiss. Use via the useSnackbar() hook:
//
//   const { showSuccess, showError, node } = useSnackbar();
//   ...
//   showSuccess('Message sent');
//   return (<View>...{node}</View>);

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

function Snackbar({ visible, type, message, onHide }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => hide(), 3200);
    }
    return () => clearTimeout(timer.current);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 80, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onHide?.());
  }, [onHide, translateY, opacity]);

  if (!visible) return null;

  const isError = type === 'error';
  const bg = isError ? '#dc2626' : '#16a34a';
  const icon = isError ? 'alert-circle' : 'checkmark-circle';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[S.wrap, { bottom: insets.bottom + 18, opacity, transform: [{ translateY }] }]}
    >
      <View style={[S.bar, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color="#fff" />
        <Text style={S.text} numberOfLines={3}>{message}</Text>
        <TouchableOpacity onPress={hide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export function useSnackbar() {
  const [state, setState] = useState({ visible: false, type: 'success', message: '' });

  const show = useCallback((message, type = 'success') => {
    // Re-mount to restart the animation if one is already showing.
    setState({ visible: false, type, message });
    requestAnimationFrame(() => setState({ visible: true, type, message }));
  }, []);

  const onHide = useCallback(() => setState((s) => ({ ...s, visible: false })), []);

  return {
    showSuccess: (m) => show(m, 'success'),
    showError:   (m) => show(m, 'error'),
    node: <Snackbar {...state} onHide={onHide} />,
  };
}

const S = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000 },
  bar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, borderRadius: 14,
    width: '100%',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  text: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600', marginHorizontal: 12, lineHeight: 19 },
});

export default Snackbar;
