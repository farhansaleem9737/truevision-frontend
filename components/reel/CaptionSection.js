// components/reel/CaptionSection.js  —  Instagram Reels–style bottom info area
import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Image, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Scrolling audio ticker ──────────────────────────────────────────────────
const AudioTicker = ({ song }) => {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: -180, duration: 5000, useNativeDriver: true }),
        Animated.timing(x, { toValue: 0,    duration: 0,    useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [song]);

  return (
    <View style={S.audioRow}>
      <Ionicons name="musical-note" size={12} color="#fff" style={{ marginRight: 6 }} />
      <View style={S.audioClip}>
        <Animated.Text numberOfLines={1} style={[S.audioText, { transform: [{ translateX: x }] }]}>
          {song}{'     ·     '}{song}
        </Animated.Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export default function CaptionSection({
  username,
  caption,
  song,
  isFollowing,
  // Optional richer state: 'none' | 'following' | 'requested'. When provided
  // it wins over the binary isFollowing — 'requested' renders a muted,
  // non-tappable "Requested" chip (private account, approval pending).
  followStatus,
  onFollow,
  isVerified,
  style,
}) {
  const [expanded, setExpanded] = useState(false);

  // Extract hashtags from caption for highlighting
  const renderCaption = (text) => {
    if (!text) return null;
    const parts = text.split(/(#\w+)/g);
    return parts.map((part, i) =>
      part.startsWith('#')
        ? <Text key={i} style={S.hashtag}>{part}</Text>
        : <Text key={i}>{part}</Text>
    );
  };

  return (
    <View style={[S.wrap, style]}>
      {/* Username + Follow */}
      <View style={S.userRow}>
        <Text style={S.username}>@{username}</Text>
        {isVerified && (
          <Ionicons name="checkmark-circle" size={14} color="#3b82f6" style={{ marginLeft: 4 }} />
        )}
        {followStatus === 'requested' ? (
          <View style={[S.followBtn, S.requestedBtn]}>
            <Text style={[S.followText, S.requestedText]}>Requested</Text>
          </View>
        ) : (followStatus ? followStatus === 'none' : !isFollowing) ? (
          <TouchableOpacity onPress={onFollow} activeOpacity={0.8} style={S.followBtn}>
            <Text style={S.followText}>Follow</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Caption */}
      {caption ? (
        <TouchableOpacity activeOpacity={0.9} onPress={() => setExpanded(e => !e)}>
          <Text numberOfLines={expanded ? undefined : 2} style={S.caption}>
            {renderCaption(caption)}
          </Text>
          {!expanded && caption.length > 80 && (
            <Text style={S.more}>more</Text>
          )}
        </TouchableOpacity>
      ) : null}

      {/* Audio */}
      {song ? <AudioTicker song={song} /> : null}
    </View>
  );
}

const S = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 14, right: 68, zIndex: 20,
  },

  userRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
  },
  username: {
    color: '#fff', fontWeight: '800', fontSize: 15,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3,
  },
  followBtn: {
    marginLeft: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4,
  },
  followText: {
    color: '#fff', fontSize: 12, fontWeight: '700',
  },
  // "Requested" — pending approval on a private account. Muted + inert.
  requestedBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  requestedText: {
    color: 'rgba(255,255,255,0.6)',
  },

  caption: {
    color: '#fff', fontSize: 13, lineHeight: 19, marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3,
  },
  hashtag: {
    color: '#93c5fd', fontWeight: '600',
  },
  more: {
    color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: -2, marginBottom: 6,
  },

  audioRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 2,
  },
  audioClip: {
    overflow: 'hidden', flex: 1,
  },
  audioText: {
    color: '#fff', fontSize: 12, fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2,
  },
});
