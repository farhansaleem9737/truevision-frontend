// truevision/components/upload/CircularProgress.js
//
// A smooth SVG circular progress ring. `progress` is 0–100; the arc animates to
// the new value on every change, so the ring always matches the real percentage
// exactly (25 = quarter, 50 = half, 100 = full). Center content via `children`.

import { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function CircularProgress({
  size = 150,
  thickness = 12,
  progress = 0,
  color = '#6C5CFF',
  track = 'rgba(120,120,140,0.18)',
  children,
}) {
  const r    = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  const anim = useRef(new Animated.Value(0)).current; // 0..1 of the circumference
  useEffect(() => {
    const p = Math.max(0, Math.min(100, progress)) / 100;
    Animated.timing(anim, {
      toValue: p, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [progress, anim]);

  const strokeDashoffset = anim.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={cx} cy={cy} r={r} stroke={track} strokeWidth={thickness} fill="none" />
        <AnimatedCircle
          cx={cx} cy={cy} r={r}
          stroke={color} strokeWidth={thickness} fill="none"
          strokeDasharray={circ}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      {children}
    </View>
  );
}
