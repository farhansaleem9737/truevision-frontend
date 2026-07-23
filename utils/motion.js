// truevision/utils/motion.js
//
// One place for animation timing, easing, and accessibility so every
// micro-animation in the app feels cohesive (Instagram / TikTok / Threads
// quality). Screens and components should read from here instead of
// hardcoding durations, so the whole experience shares one rhythm.
//
// Principles baked in:
//   • short (150–300 ms) durations
//   • smooth, non-bouncy easing (decelerated cubic for enters)
//   • native driver by default (60 FPS, off the JS thread)
//   • honours the OS "Reduce Motion" accessibility setting

import { useEffect, useState } from 'react';
import { Animated, Easing, AccessibilityInfo } from 'react-native';

// ── Durations (ms) ──────────────────────────────────────────────────────────
export const DURATION = {
  fast: 150,   // taps, toggles, quick feedback
  base: 220,   // the default for most enters
  slow: 300,   // larger surfaces (sheets, page-level fades)
};

// ── Easing curves ───────────────────────────────────────────────────────────
// `standard` decelerates into place — the calm, premium feel. No overshoot.
export const EASING = {
  standard:   Easing.out(Easing.cubic),
  decelerate: Easing.out(Easing.quad),
  inOut:      Easing.inOut(Easing.ease),
};

// ── Native-stack transition presets (consistent, quick navigation) ──────────
// Spread into a Stack.Navigator screenOptions / Stack.Screen options.
export const SCREEN_ANIM = { animation: 'slide_from_right', animationDuration: 240 };
export const MODAL_ANIM  = { animation: 'slide_from_bottom', animationDuration: 260 };
export const FADE_ANIM   = { animation: 'fade',              animationDuration: 200 };

// ── Timing helper ───────────────────────────────────────────────────────────
// Standardised Animated.timing so callers don't re-specify easing/driver.
//   createTiming(value, 1, { duration: DURATION.fast })
export const createTiming = (value, toValue, opts = {}) =>
  Animated.timing(value, {
    toValue,
    duration:        opts.duration ?? DURATION.base,
    easing:          opts.easing   ?? EASING.standard,
    delay:           opts.delay    ?? 0,
    useNativeDriver: opts.useNativeDriver ?? true,
  });

// Subtle, non-bouncy spring for press feedback (scale). friction/tension tuned
// so it settles fast without visible overshoot.
export const pressSpring = (value, toValue) =>
  Animated.spring(value, {
    toValue,
    useNativeDriver: true,
    friction: 7,
    tension:  220,
  });

// ── Reduced-motion hook ─────────────────────────────────────────────────────
// Returns true when the OS "Reduce Motion" setting is on. Components should
// then skip transforms/entrances and render final state instantly.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Initial value (guarded — the API exists on RN but be defensive).
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (mounted) setReduced(!!v); })
      .catch(() => {});
    // Live updates while the app is open.
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (v) => setReduced(!!v),
    );
    return () => { mounted = false; sub?.remove?.(); };
  }, []);

  return reduced;
}
