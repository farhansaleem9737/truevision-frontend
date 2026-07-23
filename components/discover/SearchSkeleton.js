// truevision/components/discover/SearchSkeleton.js
//
// Loading placeholders for the search results, replacing the bare spinner with
// content-shaped shimmer so the transition into results feels instant. A single
// looped opacity animation drives every block (cheap, native-driven).
//
//   <SearchRowsSkeleton />  — user/hashtag rows (Top / Users / Hashtags tabs)
//   <SearchGridSkeleton />  — 3-col video tiles (Videos tab)

import { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { useSearchTheme } from './searchTheme';

const { width } = Dimensions.get('window');
const GAP  = 2;
const TILE = (width - GAP * 2) / 3;

const usePulse = () => {
  const v = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1,   duration: 650, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
};

const Block = ({ style, color, opacity }) => (
  <Animated.View style={[style, { backgroundColor: color, opacity }]} />
);

export function SearchRowsSkeleton({ count = 8 }) {
  const c = useSearchTheme();
  const opacity = usePulse();
  return (
    <View style={{ paddingTop: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={S.row}>
          <Block style={S.avatar} color={c.skeleton} opacity={opacity} />
          <View style={S.rowBody}>
            <Block style={[S.line, { width: '52%' }]} color={c.skeleton} opacity={opacity} />
            <Block style={[S.line, { width: '34%', marginTop: 8 }]} color={c.skeleton} opacity={opacity} />
            <Block style={[S.line, { width: '44%', marginTop: 8, height: 9 }]} color={c.skeleton} opacity={opacity} />
          </View>
          <Block style={S.pill} color={c.skeleton} opacity={opacity} />
        </View>
      ))}
    </View>
  );
}

export function SearchGridSkeleton({ count = 12 }) {
  const c = useSearchTheme();
  const opacity = usePulse();
  return (
    <View style={S.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <Block key={i} style={S.tile} color={c.skeleton} opacity={opacity} />
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 12 },
  rowBody: { flex: 1 },
  line: { height: 11, borderRadius: 6 },
  pill: { width: 92, height: 34, borderRadius: 10, marginLeft: 10 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { width: TILE, height: TILE },
});
