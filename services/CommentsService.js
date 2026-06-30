// truevision/services/CommentsService.js
//
// MongoDB / Express-backed comment CRUD. Talks to the existing endpoints in
// VideoController:
//   GET    /api/videos/:id/comments
//   POST   /api/videos/:id/comments
//   PUT    /api/videos/:id/comments/:commentId
//   DELETE /api/videos/:id/comments/:commentId
//
// Public API matches the Firestore version that this replaces so CommentsSheet
// doesn't need to change. Real-time updates are approximated by polling every
// POLL_MS while a subscription is active (good enough for current scale; swap
// for Socket.IO later if comment volume justifies it).

import videoService from './VideoService';

// Polling interval for the subscribe() pseudo-realtime mode. 6 seconds is
// quick enough to feel live while keeping load light.
const POLL_MS = 6000;

// Backend's populated Comment doc → the flat shape CommentsSheet expects.
const mapComment = (c) => {
  if (!c) return null;
  const owner = c.userId && typeof c.userId === 'object' ? c.userId : null;
  return {
    id:         c._id || c.id,
    videoId:    String(c.videoId || ''),
    userId:     owner ? String(owner._id || owner.id) : String(c.userId || ''),
    username:   owner?.username || owner?.fullName || 'user',
    userAvatar: owner?.profileImage || '',
    text:       c.text || '',
    createdAt:  c.createdAt ? new Date(c.createdAt) : null,
    edited:     !!c.isEdited,
    editedAt:   c.editedAt ? new Date(c.editedAt) : null,
  };
};

const fetchList = async (videoId) => {
  if (!videoId) return [];
  const res = await videoService.getComments(videoId, 1, 'new');
  if (!res?.success) return [];
  return (res.comments || []).map(mapComment).filter(Boolean);
};

const commentsService = {

  // ── Pseudo-realtime subscription ─────────────────────────────────────────
  // Calls onChange immediately with the first fetch, then repeats every
  // POLL_MS until the returned unsubscribe function is invoked.
  subscribe: (videoId, onChange, onError) => {
    if (!videoId) {
      onChange?.([]);
      return () => {};
    }

    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const items = await fetchList(videoId);
        if (!cancelled) onChange?.(items);
      } catch (err) {
        console.warn('[CommentsService] poll error:', err.message);
        onError?.(err);
      }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    };

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  },

  // ── One-shot fetch (callers that don't need live updates) ────────────────
  list: async (videoId) => fetchList(videoId),

  // ── Create ──────────────────────────────────────────────────────────────
  // Returns the created comment's id so the caller can optimistically append.
  add: async (videoId, user, text) => {
    if (!user?._id) throw new Error('Not signed in');
    const trimmed = (text || '').trim();
    if (!trimmed) throw new Error('Comment is empty');

    const res = await videoService.addComment(videoId, trimmed);
    if (!res?.success) throw new Error(res?.message || 'Failed to post comment');
    return res.comment?._id || res.comment?.id || null;
  },

  // ── Edit ────────────────────────────────────────────────────────────────
  // CommentsSheet calls edit(commentId, currentUserId, newText). The backend
  // route is /videos/:videoId/comments/:commentId, so we need the videoId.
  // The sheet doesn't pass it here, so we route through a lookup-free path
  // that lets the caller hand it in via a (videoId, commentId) helper too.
  edit: async (commentId, currentUserId, newText, videoId) => {
    const trimmed = (newText || '').trim();
    if (!trimmed) throw new Error('Comment is empty');
    if (!videoId) throw new Error('videoId is required to edit a comment');

    const res = await videoService.editComment(videoId, commentId, trimmed);
    if (!res?.success) throw new Error(res?.message || 'Failed to edit comment');
  },

  // ── Delete ──────────────────────────────────────────────────────────────
  remove: async (commentId, videoId) => {
    if (!videoId) throw new Error('videoId is required to delete a comment');
    const res = await videoService.deleteComment(videoId, commentId);
    if (!res?.success) throw new Error(res?.message || 'Failed to delete comment');
  },
};

export default commentsService;
