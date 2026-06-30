// truevision/screens/SplashScreen.js
//
// Premium, minimalist launch screen — App Store quality.
//
// Layout (logo sits ~40% down the screen, slightly above center):
//
//        ┌──────────────────────────┐
//        │                          │
//        │        [ TV mark ]       │  ← small, flat, no container/shadow
//        │        TrueVision        │  ← 26px / 600 / #111827
//        │     Learn. Verify. Grow. │  ← 13px / light / #6B7280
//        │                          │
//        │   Preparing your feed…   │  ← muted micro-label
//        │   ▁▁▁▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁   │  ← thin indeterminate progress line
//        └──────────────────────────┘
//
// Pure white by default; honours the app's dark toggle (pure black) so the
// splash never clashes with a dark-mode session. No gray card, no heavy
// shadow, no gradient, no 3D — flat and clean.

import React, { useEffect, useRef } from 'react';
import { View, Text, StatusBar, Animated, Image, Easing, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const { height: SCREEN_H } = Dimensions.get('window');

// ── Design tokens ────────────────────────────────────────────────────────────
const LOGO_SIZE   = 72;            // small, calm
const TRACK_W     = 168;           // progress-line width
const SEGMENT_W   = 64;            // sliding highlight width

const PALETTES = {
  light: {
    bg:         '#ffffff',
    brand:      '#111827',
    tagline:    '#6B7280',
    loading:    '#9CA3AF',
    track:      '#EEF2F7',
    segment:    '#2563eb',
    statusBar:  'dark-content',
  },
  dark: {
    bg:         '#000000',
    brand:      '#ffffff',
    tagline:    'rgba(255,255,255,0.55)',
    loading:    'rgba(255,255,255,0.40)',
    track:      'rgba(255,255,255,0.10)',
    segment:    '#60a5fa',
    statusBar:  'light-content',
  },
};

export default function SplashScreen({ navigation }) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const c = isDark ? PALETTES.dark : PALETTES.light;

  // AuthProvider wraps both render paths; `navigation` is undefined on the
  // hydration path (RootNavigator) — the nav effect guards for that.
  const { isAuthenticated, loading } = useAuth();

  // ── Animation values ───────────────────────────────────────────────────────
  const markFade  = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.94)).current;
  const textFade  = useRef(new Animated.Value(0)).current;   // brand + tagline
  const progFade  = useRef(new Animated.Value(0)).current;   // loading area
  const slide     = useRef(new Animated.Value(0)).current;   // progress segment

  useEffect(() => {
    // Entrance: mark → text → loading area
    Animated.sequence([
      Animated.parallel([
        Animated.timing(markFade,  { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(markScale, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(textFade, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(progFade, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    // Indeterminate progress: a highlight glides across the track, on loop.
    Animated.loop(
      Animated.timing(slide, {
        toValue: 1, duration: 1150, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
      })
    ).start();
  }, []);

  // ── Navigation (guarded for the no-nav hydration render) ─────────────────────
  useEffect(() => {
    if (loading || !navigation) return;
    const timer = setTimeout(() => {
      navigation.replace(isAuthenticated ? 'Home' : 'Login');
    }, 2200);
    return () => clearTimeout(timer);
  }, [loading, isAuthenticated, navigation]);

  const segmentX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-SEGMENT_W, TRACK_W],
  });

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.statusBar} backgroundColor={c.bg} />

      {/* Brand cluster — positioned ~40% down the screen */}
      <View style={[styles.cluster, { paddingTop: SCREEN_H * 0.32 }]}>
        <Animated.Image
          source={require('../assets/images/tv-icon.png')}
          resizeMode="contain"
          style={{
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            opacity: markFade,
            transform: [{ scale: markScale }],
          }}
        />

        <Animated.Text style={[styles.brand, { color: c.brand, opacity: textFade }]}>
          TrueVision
        </Animated.Text>

        <Animated.Text style={[styles.tagline, { color: c.tagline, opacity: textFade }]}>
          Learn. Verify. Grow.
        </Animated.Text>
      </View>

      {/* Loading area — clean bottom */}
      <Animated.View style={[styles.loadingArea, { bottom: insets.bottom + 72, opacity: progFade }]}>
        <Text style={[styles.loadingText, { color: c.loading }]}>Preparing your feed…</Text>
        <View style={[styles.track, { backgroundColor: c.track }]}>
          <Animated.View
            style={[
              styles.segment,
              { backgroundColor: c.segment, transform: [{ translateX: segmentX }] },
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  cluster: { flex: 1, alignItems: 'center' },

  brand: {
    marginTop: 24,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  tagline: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '300',
    letterSpacing: 0.4,
  },

  loadingArea: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  track: {
    width: TRACK_W,
    height: 3,
    borderRadius: 3,
    overflow: 'hidden',
  },
  segment: {
    width: SEGMENT_W,
    height: 3,
    borderRadius: 3,
  },
});
