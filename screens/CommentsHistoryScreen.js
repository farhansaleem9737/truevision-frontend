// truevision/screens/CommentsHistoryScreen.js
//
// Every comment the signed-in user has posted, newest first. Backed by
// activityService.getMyComments(page, limit). Each card shows the video
// thumbnail (or a "Video unavailable" placeholder when the video was
// deleted), the comment text, relative date, like/reply counts, and an
// ellipsis / long-press menu with Edit & Delete — routed through the SAME
// commentsService.edit / commentsService.remove calls CommentsSheet uses.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, FlatList, Image, KeyboardAvoidingView,
  Modal, Platform, RefreshControl, StatusBar, StyleSheet, Text, TextInput,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/settings/ScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import activityService from '../services/ActivityService';
import commentsService from '../services/CommentsService';

const PAGE_SIZE = 20;
const MAX_LEN = 1000;
const SKELETON_ROWS = 6;

// ── Helpers ─────────────────────────────────────────────────────────────────
const timeAgo = (date) => {
  if (!date) return '';
  const diff = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60)     return 'now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const fmtCount = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return (v / 1_000).toFixed(1) + 'K';
  return String(v);
};

// The edit/delete API routes live under /videos/:videoId/comments/:commentId,
// so a videoId is required. Fall back to a bare videoId field if the backend
// includes one even after the video document itself was deleted.
const videoIdOf = (c) => c?.video?._id || c?.videoId || null;

// ── Skeleton loader ─────────────────────────────────────────────────────────
const SkeletonRows = ({ colors }) => {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,    duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View>
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            S.card,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pulse },
          ]}
        >
          <View style={[S.thumb, { backgroundColor: colors.divider }]} />
          <View style={{ flex: 1 }}>
            <View style={[S.skelLine, { backgroundColor: colors.divider, width: '55%' }]} />
            <View style={[S.skelLine, { backgroundColor: colors.divider, width: '92%', marginTop: 10 }]} />
            <View style={[S.skelLine, { backgroundColor: colors.divider, width: '78%', marginTop: 6 }]} />
            <View style={[S.skelLine, { backgroundColor: colors.divider, width: '34%', marginTop: 12 }]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
};

// ── Edit modal (same UX as CommentsSheet's, 1000-char limit) ────────────────
const EditModal = ({ visible, initialText = '', onCancel, onSave, saving, colors, isDark }) => {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (visible) setText(initialText);
  }, [visible, initialText]);

  const trimmed = text.trim();
  const canSave = trimmed.length > 0 && trimmed !== initialText.trim() && trimmed.length <= MAX_LEN;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={E.center}
      >
        <TouchableWithoutFeedback onPress={onCancel}>
          <View style={E.backdrop} />
        </TouchableWithoutFeedback>

        <View style={[E.card, { backgroundColor: colors.card, shadowColor: isDark ? '#000' : '#0f172a' }]}>
          <Text style={[E.title, { color: colors.text }]}>Edit comment</Text>

          <TextInput
            value={text}
            onChangeText={(t) => setText(t.slice(0, MAX_LEN))}
            multiline
            autoFocus
            placeholder="Write a comment…"
            placeholderTextColor={colors.textDim}
            style={[
              E.input,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          />

          <View style={E.metaRow}>
            <Text style={[E.counter, { color: text.length >= MAX_LEN ? colors.danger : colors.textDim }]}>
              {text.length}/{MAX_LEN}
            </Text>
          </View>

          <View style={E.btnRow}>
            <TouchableOpacity onPress={onCancel} style={[E.btn, { backgroundColor: colors.surface }]}>
              <Text style={[E.btnText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onSave(trimmed)}
              disabled={!canSave || saving}
              style={[E.btn, { backgroundColor: colors.accent, opacity: !canSave || saving ? 0.45 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[E.btnText, { color: '#fff', fontWeight: '800' }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Screen ──────────────────────────────────────────────────────────────────
export default function CommentsHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [editFor, setEditFor] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async (p = 1) => {
    const res = await activityService.getMyComments(p, PAGE_SIZE);
    if (res?.success) {
      const rows = (res.items || []).filter(Boolean);
      setItems((prev) => (p === 1 ? rows : [...prev, ...rows]));
      setPage(res.pagination?.page || p);
      setHasMore((res.pagination?.page || p) < (res.pagination?.pages || 1));
    } else if (p === 1) {
      setHasMore(false);
    }
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, []);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(1); };

  const onEndReached = () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    load(page + 1);
  };

  // ── Edit / Delete actions ──────────────────────────────────────────────
  const openActions = (item) => {
    if (!videoIdOf(item)) {
      Alert.alert(
        'Video unavailable',
        'This comment belongs to a video that no longer exists, so it can no longer be edited or deleted here.',
      );
      return;
    }
    Alert.alert(
      'Comment options',
      item.text?.length > 80 ? `${item.text.slice(0, 80)}…` : item.text,
      [
        { text: 'Edit comment', onPress: () => setEditFor(item) },
        { text: 'Delete comment', style: 'destructive', onPress: () => confirmDelete(item) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const saveEdit = async (newText) => {
    if (!editFor || savingEdit) return;
    if (!user?._id) {
      Alert.alert('Not signed in', 'Please sign in again to edit comments.');
      return;
    }
    setSavingEdit(true);
    try {
      // Same call CommentsSheet makes: commentsService.edit(commentId, userId, text, videoId)
      await commentsService.edit(editFor._id, user._id, newText, videoIdOf(editFor));
      setItems((prev) =>
        prev.map((c) => (c._id === editFor._id ? { ...c, text: newText, isEdited: true } : c)),
      );
      setEditFor(null);
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Try again');
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = (item) => {
    Alert.alert(
      'Delete this comment?',
      "This action can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const snapshot = items;
            setItems((prev) => prev.filter((c) => c._id !== item._id));
            try {
              // Same call CommentsSheet makes: commentsService.remove(commentId, videoId)
              await commentsService.remove(item._id, videoIdOf(item));
            } catch (e) {
              setItems(snapshot);
              Alert.alert('Could not delete', e?.message || 'Try again');
            }
          },
        },
      ],
    );
  };

  // ── Card ───────────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const video = item.video || null;
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={video?._id ? () => navigation.navigate('VideoPlayer', { videoId: video._id }) : undefined}
        onLongPress={() => openActions(item)}
        delayLongPress={300}
        style={[S.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {/* Thumbnail / placeholder */}
        {video?.thumbnailUrl ? (
          <Image source={{ uri: video.thumbnailUrl }} style={[S.thumb, { backgroundColor: colors.divider }]} />
        ) : (
          <View style={[S.thumb, S.thumbFallback, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="film-outline" size={22} color={colors.textDim} />
          </View>
        )}

        {/* Body */}
        <View style={{ flex: 1 }}>
          <View style={S.cardHead}>
            <Text
              style={[S.videoTitle, { color: video ? colors.textMuted : colors.textDim }]}
              numberOfLines={1}
            >
              {video ? (video.title || 'Untitled video') : 'Video unavailable'}
            </Text>
            <TouchableOpacity
              onPress={() => openActions(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={17} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <Text style={[S.commentText, { color: colors.text }]} numberOfLines={3}>
            {item.text}
          </Text>

          <View style={S.metaRow}>
            <Text style={[S.metaDate, { color: colors.textDim }]}>
              {timeAgo(item.createdAt)}
              {item.isEdited ? ' · edited' : ''}
            </Text>
            <View style={S.metaStat}>
              <Ionicons name="heart-outline" size={13.5} color={colors.textDim} />
              <Text style={[S.metaStatText, { color: colors.textDim }]}>{fmtCount(item.likesCount)}</Text>
            </View>
            <View style={S.metaStat}>
              <Ionicons name="arrow-undo-outline" size={13.5} color={colors.textDim} />
              <Text style={[S.metaStatText, { color: colors.textDim }]}>{fmtCount(item.repliesCount)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[S.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.bg} />
      <ScreenHeader title="Comments" onBack={() => navigation.goBack()} />

      {loading && items.length === 0 ? (
        <SkeletonRows colors={colors} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 18 }}><ActivityIndicator color={colors.accent} /></View>
            ) : null
          }
          ListEmptyComponent={
            <View style={S.empty}>
              <Ionicons name="chatbubbles-outline" size={42} color={colors.textDim} />
              <Text style={[S.emptyTitle, { color: colors.textMuted }]}>No comments yet</Text>
              <Text style={[S.emptySub, { color: colors.textDim }]}>
                Comments you post on videos will appear here.
              </Text>
            </View>
          }
        />
      )}

      <EditModal
        visible={!!editFor}
        initialText={editFor?.text || ''}
        onCancel={() => !savingEdit && setEditFor(null)}
        onSave={saveEdit}
        saving={savingEdit}
        colors={colors}
        isDark={isDark}
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1 },

  card: {
    flexDirection: 'row',
    marginHorizontal: 16, marginTop: 12,
    padding: 12, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 56, height: 72, borderRadius: 10, marginRight: 12 },
  thumbFallback: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  videoTitle: { fontSize: 12.5, fontWeight: '600', flex: 1, marginRight: 10 },

  commentText: { fontSize: 14, lineHeight: 20, marginTop: 4 },

  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  metaDate: { fontSize: 11.5, fontWeight: '500', marginRight: 14 },
  metaStat: { flexDirection: 'row', alignItems: 'center', marginRight: 14 },
  metaStatText: { fontSize: 11.5, fontWeight: '600', marginLeft: 4 },

  skelLine: { height: 10, borderRadius: 5 },

  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 34 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 14 },
  emptySub: { fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 },
});

const E = StyleSheet.create({
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  card: {
    width: '100%', maxWidth: 460,
    borderRadius: 20, padding: 20,
    shadowOpacity: 0.22, shadowRadius: 22, shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 14 },
  input: {
    minHeight: 96, maxHeight: 180,
    borderWidth: 1, borderRadius: 14,
    padding: 14, fontSize: 14.5, lineHeight: 20,
    textAlignVertical: 'top',
  },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  counter: { fontSize: 12, fontWeight: '600' },
  btnRow:  { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, gap: 10 },
  btn: {
    paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: 12, minWidth: 96, alignItems: 'center',
  },
  btnText: { fontSize: 14.5, fontWeight: '700' },
});
