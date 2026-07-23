// truevision/services/videoCache.js
//
// A small, best-effort LRU disk cache for short-video files. It lets the feed
// PREFETCH upcoming videos so they start instantly (played from disk, not the
// network) and be reused instead of re-downloaded — including after returning
// from the background or re-opening the app.
//
// Design goals / safety:
//   • Additive: if ANYTHING fails, callers fall back to the network URL. The
//     player never depends on the cache.
//   • No mid-play swaps: ReelCard resolves `cachedPath(url) || url` once when a
//     card's source is created; a late download completion never swaps a
//     playing source.
//   • Bounded: total size capped (MAX_BYTES); oldest entries evicted (LRU).
//   • Persistent: an index is kept in AsyncStorage so the cache survives app
//     restarts (files verified on init; missing ones pruned).
//   • Resumable + retryable: downloads use createDownloadResumable so a prefetch
//     that gets paused (user scrolled away) can RESUME from its partial bytes
//     instead of restarting, and transient failures are retried with backoff.
//   • Cancellable: keepOnly(urls) pauses/drops prefetches that are no longer
//     near the viewport, so we never waste bandwidth on videos the user blew
//     past. Paused progress is retained so a scroll-back resumes cheaply.

// SDK 54: the classic file API (downloadAsync / createDownloadResumable /
// cacheDirectory / getInfoAsync / makeDirectoryAsync / deleteAsync) lives on the
// `/legacy` subpath — on the default import these are deprecation stubs that
// THROW at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DIR        = (FileSystem.cacheDirectory || '') + 'reelcache/';
const INDEX_KEY  = '@truevision:videocache:index:v1';
const MAX_BYTES  = 300 * 1024 * 1024;   // 300 MB
const MAX_CONCURRENT = 2;
const MAX_ATTEMPTS   = 3;               // download tries before giving up (retry)

// url -> { file, size, at }   (file = absolute file:// path) — COMPLETED files.
const manifest = new Map();
// url -> entry { promise, resolve, resumable, cancelled }  — ACTIVE downloads.
const inFlight = new Map();
// url -> savable  — resume data for downloads paused by keepOnly(), so a
// scroll-back continues from the partial bytes rather than restarting.
const pausedResume = new Map();
const queue = [];                        // pending [{ url, run, entry }]
let active = 0;
let ready = false;
let persistTimer = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── djb2 hash for stable, collision-resistant filenames ──────────────────────
const hash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};
const fileFor = (url) => DIR + hash(url) + '.mp4';
const isRemote = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

const ensureDir = async () => {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  } catch (_) { /* best-effort */ }
};

const persistSoon = () => {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      const obj = {};
      for (const [url, e] of manifest) obj[url] = e;
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(obj));
    } catch (_) { /* best-effort */ }
  }, 800);
};

// ── init: load index, verify files still exist ───────────────────────────────
const init = async () => {
  try {
    await ensureDir();
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      for (const [url, e] of Object.entries(obj)) {
        if (e && e.file) manifest.set(url, e);
      }
      // Verify on-disk existence in the background; prune stale entries.
      for (const [url, e] of [...manifest]) {
        FileSystem.getInfoAsync(e.file).then((info) => {
          if (!info.exists) { manifest.delete(url); persistSoon(); }
        }).catch(() => {});
      }
    }
    // Sweep orphan partials — files left in DIR by a paused/cancelled download
    // in a previous session that were never resumed. Anything not referenced by
    // a completed manifest entry is junk we can safely reclaim on launch.
    try {
      const keepFiles = new Set([...manifest.values()].map((e) => e.file));
      const names = await FileSystem.readDirectoryAsync(DIR);
      for (const name of names) {
        const full = DIR + name;
        if (!keepFiles.has(full)) {
          FileSystem.deleteAsync(full, { idempotent: true }).catch(() => {});
        }
      }
    } catch (_) { /* best-effort */ }
  } catch (_) { /* best-effort */ } finally { ready = true; }
};
init();

// ── LRU eviction ─────────────────────────────────────────────────────────────
const totalBytes = () => {
  let t = 0;
  for (const e of manifest.values()) t += e.size || 0;
  return t;
};
const evictIfNeeded = async () => {
  if (totalBytes() <= MAX_BYTES) return;
  const entries = [...manifest.entries()].sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
  for (const [url, e] of entries) {
    if (totalBytes() <= MAX_BYTES) break;
    try { await FileSystem.deleteAsync(e.file, { idempotent: true }); } catch (_) {}
    manifest.delete(url);
  }
  persistSoon();
};

const pump = () => {
  while (active < MAX_CONCURRENT && queue.length) {
    const next = queue.shift();
    next.run();
  }
};

// ── Public API ───────────────────────────────────────────────────────────────

/** Synchronous cache lookup. Returns a file:// path or null. Bumps LRU time. */
export function cachedPath(url) {
  if (!isRemote(url)) return null;
  const e = manifest.get(url);
  if (!e) return null;
  e.at = Date.now();
  return e.file;
}

/**
 * Download `url` into the cache if not already present. De-duped by URL and
 * capped at MAX_CONCURRENT parallel downloads. Uses a resumable download so a
 * partial transfer paused by keepOnly() continues instead of restarting, and
 * retries transient failures with backoff. Resolves to the file path or null
 * (on cancellation / exhausted retries). Never throws.
 */
export function prefetch(url) {
  if (!isRemote(url)) return Promise.resolve(null);
  if (manifest.has(url)) { cachedPath(url); return Promise.resolve(manifest.get(url).file); }
  if (inFlight.has(url)) return inFlight.get(url).promise;

  let resolveOuter;
  const promise = new Promise((res) => { resolveOuter = res; });
  const entry = { promise, resolve: resolveOuter, resumable: null, cancelled: false };
  inFlight.set(url, entry);

  const run = async () => {
    active++;
    const file = fileFor(url);
    let done = false;
    try {
      await ensureDir();
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !done && !entry.cancelled; attempt++) {
        try {
          // Resume from a prior paused transfer when we have its savable state.
          const saved = pausedResume.get(url);
          const resumable = saved
            ? FileSystem.createDownloadResumable(url, file, {}, undefined, saved)
            : FileSystem.createDownloadResumable(url, file, {});
          entry.resumable = resumable;

          const result = saved
            ? await resumable.resumeAsync()
            : await resumable.downloadAsync();

          if (entry.cancelled) break;            // paused/dropped mid-flight
          pausedResume.delete(url);

          if (result && result.uri) {
            const info = await FileSystem.getInfoAsync(file);
            manifest.set(url, { file, size: info.size || 0, at: Date.now() });
            persistSoon();
            await evictIfNeeded();
            done = true;
          }
        } catch (_) {
          if (entry.cancelled) break;
          // Transient failure → gentle backoff, then retry (unless exhausted).
          if (attempt < MAX_ATTEMPTS - 1) await sleep(Math.min(500 * (attempt + 1), 2000));
        }
      }
    } catch (_) { /* best-effort */ }

    // Clean up a stray partial file only when we've truly given up: retries
    // exhausted AND not cancelled (a cancelled/paused transfer keeps its bytes
    // so a scroll-back can resume; leftover partials are swept next launch).
    if (!done && !entry.cancelled && !pausedResume.has(url)) {
      try { await FileSystem.deleteAsync(file, { idempotent: true }); } catch (_) {}
    }

    active--;
    inFlight.delete(url);
    entry.resolve(done ? file : null);
    pump();
  };

  queue.push({ url, run, entry });
  pump();
  return promise;
}

/** Prefetch several URLs (best-effort, order-preserving priority). */
export function prefetchMany(urls = []) {
  urls.filter(isRemote).forEach((u) => { prefetch(u); });
}

/**
 * Keep only the given URLs warming; pause/drop every other in-flight or queued
 * prefetch. Called by the feed as the active index moves so we stop pulling
 * bytes for videos the user scrolled past. Paused transfers retain their
 * progress (pausedResume) and resume cheaply if the URL is requested again.
 */
export function keepOnly(urlsToKeep = []) {
  const keep = new Set(urlsToKeep.filter(isRemote));

  // Drop queued (not-yet-started) prefetches outside the keep window.
  for (let i = queue.length - 1; i >= 0; i--) {
    const q = queue[i];
    if (keep.has(q.url)) continue;
    queue.splice(i, 1);
    q.entry.cancelled = true;
    inFlight.delete(q.url);
    q.entry.resolve(null);
  }

  // Pause in-flight downloads outside the keep window, retaining resume data.
  for (const [url, entry] of inFlight) {
    if (keep.has(url) || entry.cancelled) continue;
    entry.cancelled = true;
    const r = entry.resumable;
    if (r && typeof r.pauseAsync === 'function') {
      r.pauseAsync()
        .then((savable) => { if (savable) pausedResume.set(url, savable); })
        .catch(() => {});
    }
  }
}

export default { cachedPath, prefetch, prefetchMany, keepOnly };
