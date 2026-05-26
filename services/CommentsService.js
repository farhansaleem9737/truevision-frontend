// truevision/services/CommentsService.js
//
// Firestore-backed comment CRUD with real-time subscriptions.
//
// Document shape (collection: "comments"):
//   {
//     videoId:    string   — id of the video this comment belongs to
//     userId:     string   — owner uid (used for permission checks)
//     username:   string
//     userAvatar: string
//     text:       string
//     createdAt:  Timestamp
//     edited:     boolean
//     editedAt:   Timestamp | null
//   }
//
// Permission model: edit/delete are gated client-side by `comment.userId === currentUser._id`.
// The matching Firestore security rules live in services/firebase.js.

import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, onSnapshot, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db, isConfigured } from './firebase';

const COL = 'comments';

const ensureConfigured = () => {
  if (!isConfigured) {
    throw new Error('Firebase is not configured — fill in services/firebase.js');
  }
};

// Map a Firestore doc → plain comment object the UI consumes.
const mapDoc = (d) => {
  const data = d.data() || {};
  return {
    id:         d.id,
    videoId:    data.videoId,
    userId:     data.userId,
    username:   data.username || 'user',
    userAvatar: data.userAvatar || '',
    text:       data.text || '',
    createdAt:  data.createdAt?.toDate?.() || null,
    edited:     !!data.edited,
    editedAt:   data.editedAt?.toDate?.() || null,
  };
};

const commentsService = {

  // ── Real-time subscription ──────────────────────────────────────────────────
  // Returns an unsubscribe function. Call it when the sheet closes / unmounts.
  subscribe: (videoId, onChange, onError) => {
    if (!isConfigured || !videoId) {
      onChange?.([]);
      return () => {};
    }
    const q = query(
      collection(db, COL),
      where('videoId', '==', String(videoId)),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(
      q,
      (snap) => onChange?.(snap.docs.map(mapDoc)),
      (err) => {
        console.warn('[CommentsService] subscribe error:', err.message);
        onError?.(err);
      },
    );
  },

  // ── One-shot fetch (fallback for non-realtime callers) ──────────────────────
  list: async (videoId) => {
    ensureConfigured();
    const q = query(
      collection(db, COL),
      where('videoId', '==', String(videoId)),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(mapDoc);
  },

  // ── Create ──────────────────────────────────────────────────────────────────
  add: async (videoId, user, text) => {
    ensureConfigured();
    if (!user?._id) throw new Error('Not signed in');
    const trimmed = (text || '').trim();
    if (!trimmed) throw new Error('Comment is empty');

    const ref = await addDoc(collection(db, COL), {
      videoId:    String(videoId),
      userId:     user._id,
      username:   user.username || user.name || 'user',
      userAvatar: user.profileImage || user.avatar || '',
      text:       trimmed,
      createdAt:  serverTimestamp(),
      edited:     false,
      editedAt:   null,
    });
    return ref.id;
  },

  // ── Edit ────────────────────────────────────────────────────────────────────
  edit: async (commentId, currentUserId, newText) => {
    ensureConfigured();
    const trimmed = (newText || '').trim();
    if (!trimmed) throw new Error('Comment is empty');
    // Permission check is enforced by Firestore rules; we pass userId in the
    // payload so rules can compare it server-side.
    await updateDoc(doc(db, COL, commentId), {
      text:     trimmed,
      edited:   true,
      editedAt: serverTimestamp(),
      userId:   currentUserId,
    });
  },

  // ── Delete ──────────────────────────────────────────────────────────────────
  remove: async (commentId) => {
    ensureConfigured();
    await deleteDoc(doc(db, COL, commentId));
  },
};

export default commentsService;
