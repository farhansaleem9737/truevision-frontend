// truevision/components/chat/ImageViewer.js
//
// Full-screen image lightbox with pinch-to-zoom, double-tap-to-zoom, and
// swipe-to-close (via a vertical drag threshold). Built on react-native-
// gesture-handler + the RN Animated API — no extra deps.
//
// Contract:
//   <ImageViewer
//     visible={bool}                  // controls the modal
//     images={[{ url }]}              // one or more images (index-based swipe)
//     initialIndex={0}
//     onClose={fn}
//     onShare?={fn}                   // optional share button
//     onDownload?={fn}                // optional download button
//   />
//
// Kept intentionally standalone — any screen (chat bubble, feed, profile
// grid) can drop this in without new context.

import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Animated, Dimensions, StyleSheet,
  StatusBar, Platform,
} from 'react-native';
import {
  GestureHandlerRootView, PinchGestureHandler, PanGestureHandler,
  TapGestureHandler, State,
} from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
// expo-image gives us disk caching for free — same URL loaded again is instant.
import { Image } from 'expo-image';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Dismiss when the user pans this many px down (or up) with a low-scale image.
const DISMISS_THRESHOLD = 130;

export default function ImageViewer({
  visible,
  images = [],
  initialIndex = 0,
  onClose,
  onShare,
  onDownload,
}) {
  const [index, setIndex]           = useState(initialIndex);
  const [controlsHidden, setHidden] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Animated values driving the transform on the active image.
  const scale       = useRef(new Animated.Value(1)).current;
  const baseScale   = useRef(1);
  const translateX  = useRef(new Animated.Value(0)).current;
  const translateY  = useRef(new Animated.Value(0)).current;
  const backdropOp  = useRef(new Animated.Value(1)).current;

  const pinchRef = useRef(null);
  const panRef   = useRef(null);
  const doubleTapRef = useRef(null);

  const src = images[index];

  // Reset transforms + error state when the current image changes.
  useEffect(() => {
    scale.setValue(1);        baseScale.current = 1;
    translateX.setValue(0);
    translateY.setValue(0);
    backdropOp.setValue(1);
    setLoadFailed(false);
  }, [index, backdropOp, scale, translateX, translateY]);

  // ── Pinch ──────────────────────────────────────────────────────────────
  const onPinch = Animated.event([{ nativeEvent: { scale } }], { useNativeDriver: true });
  const onPinchState = (e) => {
    if (e.nativeEvent.state === State.END) {
      baseScale.current *= e.nativeEvent.scale;
      // Snap back to 1 if the user tries to zoom out below 1×.
      if (baseScale.current < 1) {
        baseScale.current = 1;
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
      } else {
        scale.setValue(baseScale.current);
      }
    }
  };

  // ── Pan (swipe to dismiss when unzoomed, otherwise repositions) ────────
  const onPan = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: true, listener: (e) => {
      // Fade the backdrop as the user pulls the image away — visual cue that
      // release will dismiss.
      if (baseScale.current <= 1) {
        const dist = Math.abs(e.nativeEvent.translationY);
        backdropOp.setValue(Math.max(0.3, 1 - dist / 400));
      }
    }},
  );
  const onPanState = (e) => {
    if (e.nativeEvent.state === State.END) {
      const dy = e.nativeEvent.translationY;
      const dx = e.nativeEvent.translationX;

      // Not zoomed: vertical drag = dismiss.
      if (baseScale.current <= 1 && Math.abs(dy) > DISMISS_THRESHOLD) {
        onClose?.();
        return;
      }
      // Not zoomed: horizontal swipe = navigate.
      if (baseScale.current <= 1 && Math.abs(dx) > 80 && images.length > 1) {
        if (dx < 0 && index < images.length - 1) setIndex(i => i + 1);
        else if (dx > 0 && index > 0)             setIndex(i => i - 1);
      }

      // Spring back to origin/scale.
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  };

  // ── Double-tap: toggle 1× ↔ 2.5× centred on the tap point. ─────────────
  const onDoubleTap = (e) => {
    if (e.nativeEvent.state !== State.ACTIVE) return;
    const target = baseScale.current > 1 ? 1 : 2.5;
    baseScale.current = target;
    Animated.spring(scale, { toValue: target, useNativeDriver: true, friction: 6 }).start();
  };

  // ── Single-tap: hide/show controls (WhatsApp behaviour). ───────────────
  const onSingleTap = (e) => {
    if (e.nativeEvent.state === State.ACTIVE) setHidden(v => !v);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      // Android status bar behind modal — we want the black backdrop under it.
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar hidden={Platform.OS === 'ios'} />

        <Animated.View style={[V.backdrop, { opacity: backdropOp }]} />

        {/* Nested gesture handlers: singleTap waits on doubleTap; both defer
            to pan/pinch when a real gesture starts. */}
        <TapGestureHandler
          ref={doubleTapRef}
          numberOfTaps={2}
          onHandlerStateChange={onDoubleTap}
        >
          <TapGestureHandler
            numberOfTaps={1}
            waitFor={doubleTapRef}
            onHandlerStateChange={onSingleTap}
          >
            <Animated.View style={V.container}>
              <PanGestureHandler
                ref={panRef}
                onGestureEvent={onPan}
                onHandlerStateChange={onPanState}
                minPointers={1}
                maxPointers={1}
              >
                <Animated.View style={{ flex: 1 }}>
                  <PinchGestureHandler
                    ref={pinchRef}
                    onGestureEvent={onPinch}
                    onHandlerStateChange={onPinchState}
                  >
                    <Animated.View style={V.imageWrap}>
                      {src?.url ? (
                        <Animated.View
                          style={{
                            transform: [
                              { translateX },
                              { translateY },
                              { scale },
                            ],
                          }}
                        >
                          <Image
                            source={{ uri: src.url }}
                            style={{ width: SCREEN_W, height: SCREEN_H * 0.9 }}
                            contentFit="contain"
                            cachePolicy="memory-disk"
                            transition={100}
                            onLoad={() => setLoadFailed(false)}
                            onError={() => setLoadFailed(true)}
                          />
                          {loadFailed && (
                            <View style={V.viewerError}>
                              <Ionicons name="alert-circle-outline" size={40} color="rgba(255,255,255,0.9)" />
                              <Text style={V.viewerErrorTxt}>Couldn’t load image</Text>
                            </View>
                          )}
                        </Animated.View>
                      ) : null}
                    </Animated.View>
                  </PinchGestureHandler>
                </Animated.View>
              </PanGestureHandler>
            </Animated.View>
          </TapGestureHandler>
        </TapGestureHandler>

        {!controlsHidden && (
          <>
            {/* Top bar */}
            <View style={V.topBar} pointerEvents="box-none">
              <TouchableOpacity onPress={onClose} style={V.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={V.counter}>
                {images.length > 1 ? `${index + 1} / ${images.length}` : ''}
              </Text>
              <View style={V.rightBtns}>
                {onDownload && (
                  <TouchableOpacity onPress={() => onDownload(src)} style={V.iconBtn}>
                    <Ionicons name="download-outline" size={22} color="#fff" />
                  </TouchableOpacity>
                )}
                {onShare && (
                  <TouchableOpacity onPress={() => onShare(src)} style={V.iconBtn}>
                    <Ionicons name="share-outline" size={22} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const V = StyleSheet.create({
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  container:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerError:    { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  viewerErrorTxt: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 8 },

  topBar:     {
    position: 'absolute', top: Platform.OS === 'ios' ? 48 : 24,
    left: 0, right: 0, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
  },
  counter:    { flex: 1, textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: '600' },
  rightBtns:  { flexDirection: 'row', alignItems: 'center' },
  iconBtn:    { padding: 8 },
});
