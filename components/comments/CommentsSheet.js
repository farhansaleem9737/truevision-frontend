// truevision/components/comments/CommentsSheet.js
//
// Instagram-style comment sheet backed by Firestore.
//   • real-time updates via onSnapshot
//   • long-press own comment → Edit / Delete / Cancel action sheet
//   • edit modal (pre-filled, char-limited, save disabled when empty/unchanged)
//   • delete confirmation Alert
//   • "(edited)" label + relative timestamp
//   • dark-mode via useTheme()
//
// Drop-in replacement for the inline CommentSheet that lived in HomeScreen,
// ReelsFeedScreen and VideoPlayerScreen. All three pass the same props:
//   visible, onClose, videoId, commentCount, isExternal, tabOffset

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TouchableWithoutFeedback,
  Image, TextInput, KeyboardAvoidingView, Animated, Modal, Alert,
  StatusBar, Dimensions, Platform, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import commentsService from '../../services/CommentsService';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const { height } = Dimensions.get('window');
const MAX_LEN = 300;

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmtCount = (n) => {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const fmtTime = (date) => {
  if (!date) return 'now';
  const diff = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (diff < 60)        return 'now';
  if (diff < 3600)      return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / (86400 * 7))}w`;
};

// ── Action sheet for own comments ───────────────────────────────────────────
const ActionSheet = ({ visible, onClose, onEdit, onDelete, colors, isDark }) => {
  const insets  = useSafeAreaInsets();
  const slide   = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 0 : 300,
      useNativeDriver: true, friction: 22, tension: 220,
    }).start();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={A.backdrop}>
          <TouchableWithoutFeedback>
            <Animated.View style={[
              A.sheet,
              {
                backgroundColor: colors.card,
                paddingBottom: Math.max(insets.bottom, 14),
                transform: [{ translateY: slide }],
                shadowColor: isDark ? '#000' : '#0f172a',
              },
            ]}>
              <View style={[A.handle, { backgroundColor: colors.divider }]} />

              <TouchableOpacity style={A.row} onPress={onEdit} activeOpacity={0.7}>
                <Ionicons name="create-outline" size={22} color={colors.accent} />
                <Text style={[A.label, { color: colors.accent }]}>Edit Comment</Text>
              </TouchableOpacity>

              <View style={[A.divider, { backgroundColor: colors.divider }]} />

              <TouchableOpacity style={A.row} onPress={onDelete} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={22} color={colors.danger} />
                <Text style={[A.label, { color: colors.danger }]}>Delete Comment</Text>
              </TouchableOpacity>

              <View style={[A.divider, { backgroundColor: colors.divider, marginVertical: 6 }]} />

              <TouchableOpacity style={A.row} onPress={onClose} activeOpacity={0.7}>
                <Text style={[A.cancel, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ── Edit modal ──────────────────────────────────────────────────────────────
const EditModal = ({ visible, initialText = '', onCancel, onSave, saving, colors, isDark }) => {
  const insets = useSafeAreaInsets();
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
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
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
              style={[
                E.btn,
                E.btnPrimary,
                { backgroundColor: colors.accent, opacity: !canSave || saving ? 0.45 : 1 },
              ]}
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

// ── Single comment row ──────────────────────────────────────────────────────
const CommentRow = ({ item, isOwner, onLongPress, colors }) => {
  const avatar = item.userAvatar || 'https://i.pravatar.cc/150?img=10';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onLongPress={isOwner ? onLongPress : undefined}
      delayLongPress={250}
      style={S.cRow}
    >
      <Image source={{ uri: avatar }} style={[S.cAvatar, { backgroundColor: colors.divider }]} />
      <View style={{ flex: 1 }}>
        <View style={S.cHead}>
          <Text style={[S.cUser, { color: colors.text }]}>{item.username}</Text>
          <Text style={[S.cTime, { color: colors.textDim }]}>  {fmtTime(item.createdAt)}</Text>
          {item.edited && (
            <Text style={[S.cEdited, { color: colors.textDim }]}>  · edited</Text>
          )}
        </View>
        <Text style={[S.cText, { color: colors.textMuted }]}>{item.text}</Text>
      </View>
      {isOwner && (
        <Ionicons
          name="ellipsis-horizontal"
          size={16}
          color={colors.textDim}
          style={{ marginTop: 4, marginLeft: 6 }}
        />
      )}
    </TouchableOpacity>
  );
};

// ── Main component ──────────────────────────────────────────────────────────
export default function CommentsSheet({
  visible,
  onClose,
  videoId,
  commentCount = 0,
  isExternal = false,
  tabOffset = 0,
  onCountChange,
}) {
  const insets   = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const slideY = useRef(new Animated.Value(height)).current;
  const [comments, setComments] = useState([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [posting, setPosting]   = useState(false);
  const [count, setCount]       = useState(commentCount);

  // action-sheet / edit-modal state
  const [actionFor, setActionFor] = useState(null);   // comment object or null
  const [editFor, setEditFor]     = useState(null);
  const [editing, setEditing]     = useState(false);

  useEffect(() => setCount(commentCount), [commentCount]);

  // Slide animation
  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : height,
      useNativeDriver: true, friction: 26, tension: 240,
    }).start();
  }, [visible]);

  // Real-time subscription — only while the sheet is visible & video is supported
  useEffect(() => {
    if (!visible) return;
    if (isExternal || !videoId) {
      setComments([]);
      return;
    }
    setLoading(true);
    const unsub = commentsService.subscribe(
      videoId,
      (next) => {
        setComments(next);
        setCount(next.length);
        onCountChange?.(next.length);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [visible, videoId, isExternal, onCountChange]);

  // ── Post a new comment ───────────────────────────────────────────────────
  const post = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !videoId || isExternal || posting) return;
    setPosting(true);
    try {
      await commentsService.add(videoId, user, trimmed);
      setText('');
      Haptics.selectionAsync().catch(() => {});
    } catch (e) {
      Alert.alert('Could not post', e.message || 'Try again');
    } finally {
      setPosting(false);
    }
  }, [text, videoId, isExternal, posting, user]);

  // ── Long press → action sheet ────────────────────────────────────────────
  const handleLongPress = useCallback((c) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setActionFor(c);
  }, []);

  const closeAction = useCallback(() => setActionFor(null), []);

  const startEdit = useCallback(() => {
    if (!actionFor) return;
    const c = actionFor;
    setActionFor(null);
    // small delay so the action sheet's fade-out doesn't fight the modal's fade-in
    setTimeout(() => setEditFor(c), 160);
  }, [actionFor]);

  const saveEdit = useCallback(async (newText) => {
    if (!editFor || !user?._id) return;
    setEditing(true);
    try {
      await commentsService.edit(editFor.id, user._id, newText);
      setEditFor(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      Alert.alert('Could not save', e.message || 'Try again');
    } finally {
      setEditing(false);
    }
  }, [editFor, user]);

  const confirmDelete = useCallback(() => {
    if (!actionFor) return;
    const c = actionFor;
    setActionFor(null);
    setTimeout(() => {
      Alert.alert(
        'Delete this comment?',
        'This action can\'t be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await commentsService.remove(c.id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              } catch (e) {
                Alert.alert('Could not delete', e.message || 'Try again');
              }
            },
          },
        ],
      );
    }, 160);
  }, [actionFor]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const trimmed = text.trim();
  const canPost = trimmed.length > 0 && !isExternal && !posting && trimmed.length <= MAX_LEN;
  const remaining = MAX_LEN - text.length;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {visible && (
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={S.sheetBackdrop} />
        </TouchableWithoutFeedback>
      )}

      <Animated.View style={[
        S.sheet,
        {
          bottom: tabOffset,
          backgroundColor: colors.card,
          transform: [{ translateY: slideY }],
        },
      ]}>
        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={[S.sheetHandle, { backgroundColor: colors.divider }]} />
        </View>

        {/* Header */}
        <View style={S.sheetHeader}>
          <Text style={[S.sheetTitle, { color: colors.text }]}>Comments</Text>
          <Text style={[S.sheetCount, { color: colors.textMuted }]}>{fmtCount(count)}</Text>
          <TouchableOpacity onPress={onClose} style={{ marginLeft: 'auto' }} hitSlop={S.hit}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <View style={[S.sheetDivider, { backgroundColor: colors.divider }]} />

        {/* Body */}
        {loading ? (
          <ActivityIndicator style={{ paddingTop: 40 }} color={colors.accent} />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
            renderItem={({ item }) => (
              <CommentRow
                item={item}
                isOwner={!!user && item.userId === user._id}
                onLongPress={() => handleLongPress(item)}
                colors={colors}
              />
            )}
            ListEmptyComponent={
              <View style={S.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={42} color={colors.textDim} />
                <Text style={[S.emptyTitle, { color: colors.textMuted }]}>
                  Be the first to comment
                </Text>
                <Text style={[S.emptySub, { color: colors.textDim }]}>
                  {isExternal
                    ? 'Conversations on imported videos start here.'
                    : 'No comments yet — share your thoughts!'}
                </Text>
              </View>
            }
          />
        )}

        {/* Input */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[
            S.cInputRow,
            {
              paddingBottom: Math.max(insets.bottom, 10),
              borderTopColor: colors.divider,
              backgroundColor: colors.card,
            },
          ]}>
            <View style={[S.cInputBox, { backgroundColor: colors.surface }]}>
              <TextInput
                value={text}
                onChangeText={(t) => setText(t.slice(0, MAX_LEN))}
                placeholder={isExternal ? 'Comments are read-only on imported videos' : 'Add a comment…'}
                placeholderTextColor={colors.textDim}
                style={[S.cInput, { color: colors.text }]}
                editable={!isExternal && !posting}
                returnKeyType="send"
                onSubmitEditing={post}
              />
              {text.length > 0 && (
                <Text style={[
                  S.cCounter,
                  { color: remaining <= 20 ? colors.danger : colors.textDim },
                ]}>
                  {remaining}
                </Text>
              )}
              {trimmed.length > 0 && (
                <TouchableOpacity onPress={post} disabled={!canPost} hitSlop={S.hit}>
                  {posting ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={[
                      S.cPostBtn,
                      { color: colors.accent, opacity: canPost ? 1 : 0.4 },
                    ]}>
                      Post
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Action sheet (Edit / Delete / Cancel) */}
      <ActionSheet
        visible={!!actionFor}
        onClose={closeAction}
        onEdit={startEdit}
        onDelete={confirmDelete}
        colors={colors}
        isDark={isDark}
      />

      {/* Edit modal */}
      <EditModal
        visible={!!editFor}
        initialText={editFor?.text || ''}
        onCancel={() => !editing && setEditFor(null)}
        onSave={saveEdit}
        saving={editing}
        colors={colors}
        isDark={isDark}
      />
    </>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  hit: { top: 8, bottom: 8, left: 8, right: 8 },

  sheetBackdrop: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50,
  },
  sheet: {
    position: 'absolute', left: 0, right: 0,
    height: height * 0.65,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    zIndex: 100,
  },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, marginBottom: 4 },
  sheetHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  sheetTitle:   { fontWeight: '800', fontSize: 16 },
  sheetCount:   { fontWeight: '600', fontSize: 14, marginLeft: 8 },
  sheetDivider: { height: 1 },

  cRow:    { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 14, marginBottom: 4 },
  cAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 12 },
  cHead:   { flexDirection: 'row', alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' },
  cUser:   { fontSize: 13, fontWeight: '700' },
  cTime:   { fontSize: 11.5, fontWeight: '500' },
  cEdited: { fontSize: 11.5, fontStyle: 'italic' },
  cText:   { fontSize: 14, lineHeight: 20 },

  empty: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 14 },
  emptySub:   { fontSize: 13, marginTop: 6, textAlign: 'center' },

  cInputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1,
  },
  cInputBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  cInput:    { flex: 1, fontSize: 14, paddingVertical: 0 },
  cPostBtn:  { fontWeight: '800', fontSize: 14, marginLeft: 10 },
  cCounter:  { fontSize: 11, fontWeight: '600', marginLeft: 6 },
});

const A = StyleSheet.create({
  backdrop: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 8, paddingHorizontal: 8,
    shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginBottom: 6,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 18,
  },
  label:   { fontSize: 15.5, fontWeight: '700', marginLeft: 14 },
  cancel:  { fontSize: 15.5, fontWeight: '700', textAlign: 'center', flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
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
  btnPrimary: { },
  btnText: { fontSize: 14.5, fontWeight: '700' },
});
