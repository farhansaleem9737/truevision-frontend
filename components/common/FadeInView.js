// truevision/components/common/FadeInView.js
//
// One-shot mount fade (+ optional gentle rise) for content that appears:
// cards on first display, empty states, error states. Native-driven, runs
// once, and never re-animates on scroll — wrap the item, not each list row
// mid-scroll. Honours Reduce Motion (renders final state instantly).
//
// Usage:
//   <FadeInView><EmptyState … /></FadeInView>
//   <FadeInView delay={60} rise={12}><Card … /></FadeInView>

import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { DURATION, EASING, useReducedMotion } from '../../utils/motion';

export default function FadeInView({
  children,
  style,
  delay = 0,
  rise = 8,            // px of upward travel; 0 = pure fade
  duration = DURATION.base,
}) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) { t.setValue(1); return; }
    const anim = Animated.timing(t, {
      toValue: 1,
      duration,
      delay,
      easing: EASING.standard,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced, t, duration, delay]);

  const animatedStyle = reduced
    ? null
    : {
        opacity: t,
        transform: rise
          ? [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }]
          : undefined,
      };

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
