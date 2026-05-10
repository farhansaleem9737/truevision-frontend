// components/reel/ActionButtons.js  —  Instagram Reels–style compact right column
import { useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const fmt = (n) => {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const ActionBtn = ({ name, activeName, count, active, color, activeColor, onPress, size = 26 }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, useNativeDriver: true, friction: 4 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true }),
    ]).start();
    onPress?.();
  }, [onPress]);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={S.btn}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={active ? (activeName || name) : name}
          size={size}
          color={active ? (activeColor || '#fff') : (color || '#fff')}
        />
      </Animated.View>
      {count !== undefined && (
        <Text style={[S.count, active && activeColor && { color: activeColor }]}>
          {fmt(count)}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Premium circular Repost button — gradient pill with depth shadow and a 180°
// spin on toggle. Inactive uses a subtle frosted-glass gradient that sits
// quietly with the other action icons; active flips to a vivid blue→purple
// gradient with a soft glow so the state is unmistakable at a glance.
// ─────────────────────────────────────────────────────────────────────────────
const INACTIVE_GRADIENT = ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)'];
const ACTIVE_GRADIENT   = ['#3b82f6', '#8b5cf6'];   // blue-500 → violet-500
const ACTIVE_LABEL      = '#c4b5fd';                // violet-300, readable on dark bg

const RepostBtn = ({ count, active, onPress }) => {
  const scale  = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  // Quick spin whenever the toggle changes (driven by user tap or by the
  // server reconciling state back to the client).
  const isInitial = useRef(true);
  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return; }
    rotate.setValue(0);
    Animated.timing(rotate, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start();
  }, [active, rotate]);

  // Press feedback — quick subtle dip rather than a punchy enlarge so the
  // button reads as "tactile / pressable" instead of bouncy.
  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.92,
      useNativeDriver: true,
      friction: 6, tension: 220,
    }).start();
  }, [scale]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4, tension: 200,
    }).start();
  }, [scale]);

  const rotation = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      style={S.btn}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient
          colors={active ? ACTIVE_GRADIENT : INACTIVE_GRADIENT}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[S.repostPill, active ? S.repostPillActive : S.repostPillInactive]}
        >
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name="repeat" size={20} color="#fff" />
          </Animated.View>
        </LinearGradient>
      </Animated.View>
      <Text style={[S.count, active && { color: ACTIVE_LABEL, fontWeight: '800' }]}>
        {fmt(count)}
      </Text>
    </TouchableOpacity>
  );
};

const initialOf = (name) => {
  if (!name || typeof name !== 'string') return '?';
  return name.trim().charAt(0).toUpperCase() || '?';
};

export default function ActionButtons({
  avatarUri,
  avatarName,
  likes, comments, shares, saves, reposts,
  isLiked, isSaved, isReposted,
  onLike, onComment, onShare, onSave, onRepost, onMore,
  onAvatarPress,
  style,
}) {
  return (
    <View style={[S.col, style]}>
      {/* User avatar — falls back to initial circle when no image is provided */}
      <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.85} style={S.avatarWrap}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={S.avatar} />
        ) : (
          <View style={[S.avatar, S.avatarFallback]}>
            <Text style={S.avatarInitials}>{initialOf(avatarName)}</Text>
          </View>
        )}
        <View style={S.avatarPlus}>
          <Ionicons name="add" size={12} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Like */}
      <ActionBtn
        name="heart-outline" activeName="heart"
        count={likes} active={isLiked}
        activeColor="#ff2d55"
        onPress={onLike}
        size={28}
      />

      {/* Comment */}
      <ActionBtn
        name="chatbubble-ellipses-outline"
        count={comments}
        onPress={onComment}
        size={26}
      />

      {/* Share */}
      <ActionBtn
        name="paper-plane-outline"
        count={shares}
        onPress={onShare}
        size={25}
      />

      {/* Save */}
      <ActionBtn
        name="bookmark-outline" activeName="bookmark"
        count={saves} active={isSaved}
        activeColor="#3b82f6"
        onPress={onSave}
        size={25}
      />

      {/* Repost — dedicated button with spin + halo for a polished feel */}
      <RepostBtn count={reposts} active={isReposted} onPress={onRepost} />

      {/* More */}
      <TouchableOpacity onPress={onMore} activeOpacity={0.7} style={S.btn}>
        <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const S = StyleSheet.create({
  col: {
    position: 'absolute', right: 10, alignItems: 'center', zIndex: 20,
  },

  btn: {
    alignItems: 'center', marginBottom: 16,
  },
  count: {
    color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3,
  },

  avatarWrap: {
    marginBottom: 20, alignItems: 'center',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: '#fff',
    backgroundColor: '#333',
  },
  avatarFallback: {
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff', fontWeight: '800', fontSize: 16,
  },
  avatarPlus: {
    position: 'absolute', bottom: -6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#ff2d55', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#000',
  },

  // ── Repost (premium gradient pill) ────────────────────────────────────
  repostPill: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  repostPillInactive: {
    borderColor: 'rgba(255,255,255,0.18)',
    // Soft black shadow lifts the pill off the dark video background
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  repostPillActive: {
    borderColor: 'rgba(196,181,253,0.55)',
    // Violet glow when reposted — reads as "lit up"
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
