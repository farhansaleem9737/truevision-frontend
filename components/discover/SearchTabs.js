// truevision/components/discover/SearchTabs.js
//
// Top / Users / Videos / Hashtags tab selector. A purple underline springs to
// the active tab. Theme-aware via useSearchTheme. Shown only while searching.

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSearchTheme } from './searchTheme';

const TABS = [
  { key: 'top',      label: 'Top' },
  { key: 'users',    label: 'Users' },
  { key: 'videos',   label: 'Videos' },
  { key: 'hashtags', label: 'Hashtags' },
];

export default function SearchTabs({ active, onChange }) {
  const c = useSearchTheme();
  const { width } = useWindowDimensions();
  const tabWidth  = width / TABS.length;
  const idx       = Math.max(0, TABS.findIndex((t) => t.key === active));
  const underline = useRef(new Animated.Value(idx * tabWidth)).current;

  useEffect(() => {
    Animated.spring(underline, {
      toValue: idx * tabWidth,
      useNativeDriver: true,
      friction: 18, tension: 200,
    }).start();
  }, [idx, tabWidth]); // eslint-disable-line

  const INDICATOR = tabWidth * 0.42;

  return (
    <View style={[S.wrap, { backgroundColor: c.bg, borderBottomColor: c.divider }]}>
      <View style={S.rowInner}>
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onChange(tab.key)}
              activeOpacity={0.7}
              style={[S.tab, { width: tabWidth }]}
            >
              <Text style={[
                S.label,
                { color: isActive ? c.text : c.textDim, fontWeight: isActive ? '800' : '600' },
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Animated.View
        style={[
          S.indicator,
          {
            width: INDICATOR,
            backgroundColor: c.accent,
            transform: [{ translateX: Animated.add(underline, new Animated.Value((tabWidth - INDICATOR) / 2)) }],
          },
        ]}
      />
    </View>
  );
}

export { TABS as SEARCH_TABS };

const S = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  rowInner: { flexDirection: 'row' },
  tab: { paddingVertical: 13, alignItems: 'center' },
  label: { fontSize: 14 },
  indicator: {
    position: 'absolute', bottom: -0.5, left: 0,
    height: 2.5, borderRadius: 2,
  },
});
