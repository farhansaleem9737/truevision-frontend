// truevision/components/video/InfoButton.js
//
// Subtle, minimalistic ⓘ button drawn on the top-right of a video card.
// Designed to be lightweight and non-intrusive — translucent circle,
// 28px hit area, no shadow, no animation. Tap fires `onPress`.

import { Pressable, StyleSheet, Text } from 'react-native';

export default function InfoButton({ onPress, color = '#fff', size = 28 }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        S.btn,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && { opacity: 0.7 },
      ]}
    >
      {/* Use a real text glyph instead of an icon so the look stays
          minimal and matches the spec's "ⓘ" example exactly. */}
      <Text style={[S.glyph, { color }]}>ⓘ</Text>
    </Pressable>
  );
}

const S = StyleSheet.create({
  btn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  glyph: { fontSize: 17, fontWeight: '400', lineHeight: 20 },
});
