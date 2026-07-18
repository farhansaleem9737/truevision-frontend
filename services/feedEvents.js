// truevision/services/feedEvents.js
//
// Tiny module-level event bus that lets a preference change on one screen
// (Content Preferences / Interested Topics) tell the Home feed on another
// screen to refetch — without threading callbacks through navigation.
//
// Same pattern as services/sessionGuard.js. Kept deliberately minimal.
//
// Contract: emitFeedRefresh() is fired ONLY after the backend has confirmed
// a recommendation-affecting preference change (and therefore already cleared
// this user's feed cache), so the refetch that follows is guaranteed fresh.

const listeners = new Set();

/** Subscribe to feed-refresh requests. Returns an unsubscribe function. */
export const onFeedRefresh = (cb) => {
  if (typeof cb !== 'function') return () => {};
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** Ask every subscribed feed to refetch. `reason` is passed through for logs. */
export const emitFeedRefresh = (reason = 'prefs-changed') => {
  for (const cb of listeners) {
    try { cb(reason); } catch (_) { /* isolate a bad listener */ }
  }
};
