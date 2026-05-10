// components/reel/TopTabs.js  —  TikTok-style Trending / Following tabs
import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';

const TABS = [
  { key: 'trending',  label: 'Trending'  },
  { key: 'following', label: 'Following' },
];

export default function TopTabs({ active, onChange, style }) {
  const slide = useRef(new Animated.Value(active === 'trending' ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: active === 'trending' ? 0 : 1,
      useNativeDriver: true,
      friction: 20,
      tension: 180,
    }).start();
  }, [active]);

  const translateX = slide.interpolate({
    inputRange:  [0, 1],
    outputRange: [-44, 44],
  });

  return (
    <View style={[S.wrap, style]} pointerEvents="box-none">
      <View style={S.row}>
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onChange(tab.key)}
              activeOpacity={0.7}
              style={S.tab}
            >
              <Text style={[S.label, isActive && S.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Animated.View style={[S.indicator, { transform: [{ translateX }] }]} />
    </View>
  );
}

const S = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', zIndex: 50,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 18, paddingVertical: 8,
  },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16, fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4,
  },
  labelActive: {
    color: '#fff', fontWeight: '800', fontSize: 17,
  },
  indicator: {
    width: 28, height: 3, borderRadius: 2,
    backgroundColor: '#fff',
    marginTop: 2,
  },
});
