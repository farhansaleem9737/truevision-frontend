// truevision/components/common/PressableScale.js
//
// Drop-in button wrapper that adds subtle, premium press feedback: a small
// scale-down on press-in and a smooth, non-bouncy settle on release. Native-
// driven and instant to the touch — the press never waits on the animation.
// Honours Reduce Motion (no transform; behaves like a plain Pressable).
//
// Scale-only by design: it never touches `opacity`, so a caller's own opacity
// (e.g. a disabled-state dim in the style) is always preserved. Behaves like
// TouchableOpacity for callers — forwards onPress, disabled, hitSlop and
// accessibility props. The visual style lives on the inner animated view so
// the scale transform composes cleanly.
//
// Usage:
//   <PressableScale onPress={submit} disabled={!canSave} style={S.cta}>
//     <Text>Continue</Text>
//   </PressableScale>

import { useCallback, useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { pressSpring, useReducedMotion } from '../../utils/motion';

export default function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  disabled = false,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}) {
  const reduced = useReducedMotion();
  const scale   = useRef(new Animated.Value(1)).current;

  const handleIn = useCallback((e) => {
    if (!reduced && !disabled) pressSpring(scale, scaleTo).start();
    onPressIn?.(e);
  }, [reduced, disabled, scale, scaleTo, onPressIn]);

  const handleOut = useCallback((e) => {
    if (!reduced && !disabled) pressSpring(scale, 1).start();
    onPressOut?.(e);
  }, [reduced, disabled, scale, onPressOut]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handleIn}
      onPressOut={handleOut}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
