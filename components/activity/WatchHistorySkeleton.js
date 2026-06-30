// truevision/components/activity/WatchHistorySkeleton.js
//
// Lightweight shimmering skeleton grid for the Watch History first-load
// state. Renders nine placeholder tiles in 3 columns; opacity oscillates
// via Animated to mimic a shimmer without a heavy gradient library.

import { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');
const GAP  = 10;
const COLS = 3;
const SIDE_PAD = 16;
const TILE_W = (SCREEN_W - SIDE_PAD * 2 - GAP * (COLS - 1)) / COLS;

export default function WatchHistorySkeleton({ rows = 3 }) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const tiles = Array.from({ length: rows * COLS });
  const animatedColor = { backgroundColor: colors.divider, opacity: pulse };

  return (
    <View style={[S.grid, { paddingHorizontal: SIDE_PAD }]}>
      {tiles.map((_, i) => (
        <View key={i} style={[S.tileWrap, { width: TILE_W }]}>
          <Animated.View style={[S.thumb, animatedColor, { width: TILE_W }]} />
          <Animated.View style={[S.lineLg, animatedColor, { width: TILE_W * 0.9 }]} />
          <Animated.View style={[S.lineSm, animatedColor, { width: TILE_W * 0.6 }]} />
        </View>
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingTop: 8 },
  tileWrap: { marginBottom: 14 },
  thumb:    { aspectRatio: 9 / 14, borderRadius: 12 },
  lineLg:   { height: 10, borderRadius: 4, marginTop: 8 },
  lineSm:   { height: 8,  borderRadius: 4, marginTop: 6 },
});
