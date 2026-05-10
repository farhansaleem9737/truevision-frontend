// truevision/components/discover/SearchTabs.js
//
// Top / Users / Videos / Hashtags tab selector. Animated underline tracks
// the active tab. Used only when the user is actively searching.

import { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

const TABS = [
  { key: 'top',      label: 'Top' },
  { key: 'users',    label: 'Users' },
  { key: 'videos',   label: 'Videos' },
  { key: 'hashtags', label: 'Hashtags' },
];

export default function SearchTabs({ active, onChange }) {
  const { width } = useWindowDimensions();
  const tabWidth  = width / TABS.length;
  const underline = useRef(new Animated.Value(TABS.findIndex((t) => t.key === active) * tabWidth)).current;

  useEffect(() => {
    const idx = TABS.findIndex((t) => t.key === active);
    Animated.spring(underline, {
      toValue: Math.max(0, idx) * tabWidth,
      useNativeDriver: true,
      friction: 18, tension: 200,
    }).start();
  }, [active, tabWidth]);

  return (
    <View style={S.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={{ flexDirection: 'row' }}
      >
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onChange(tab.key)}
              activeOpacity={0.7}
              style={[S.tab, { width: tabWidth }]}
            >
              <Text style={[S.label, isActive && S.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Animated.View
        style={[
          S.indicator,
          {
            width: tabWidth * 0.36,
            transform: [{
              translateX: Animated.add(underline, new Animated.Value((tabWidth - tabWidth * 0.36) / 2)),
            }],
          },
        ]}
      />
    </View>
  );
}

export { TABS as SEARCH_TABS };

const S = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0',
  },
  tab:  { paddingVertical: 12, alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  labelActive: { color: '#0f172a', fontWeight: '800' },
  indicator: {
    position: 'absolute', bottom: 0, left: 0,
    height: 2.5, borderRadius: 2, backgroundColor: '#0f172a',
  },
});
