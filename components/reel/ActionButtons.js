// components/reel/ActionButtons.js  —  Instagram Reels–style compact right column
import { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

export default function ActionButtons({
  avatarUri,
  likes, comments, shares, saves,
  isLiked, isSaved,
  onLike, onComment, onShare, onSave, onMore,
  onAvatarPress,
  style,
}) {
  return (
    <View style={[S.col, style]}>
      {/* User avatar */}
      <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.85} style={S.avatarWrap}>
        <Image source={{ uri: avatarUri }} style={S.avatar} />
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
  avatarPlus: {
    position: 'absolute', bottom: -6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#ff2d55', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#000',
  },
});
