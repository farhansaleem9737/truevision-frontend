// truevision/services/evidenceMeta.js
//
// Metadata for evidence links shown in the "About this video" panel:
//   • extractUrl()  — pulls a real, openable https URL out of whatever the
//     creator pasted (many paste "Title - Site https://…", or a bare domain).
//   • getMeta(url)  — resolves { title, domain, favicon, ok } for a URL, with
//     a three-layer cache (in-memory → AsyncStorage → network) and in-flight
//     de-duplication so the same URL is never fetched twice.
//
// The fetch is best-effort with a hard timeout: on any failure the caller
// still gets { domain, favicon, ok:false } so the UI can render a useful card
// (domain + retry) instead of a broken one. Failures are NOT persisted, so
// Retry genuinely refetches.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY   = '@truevision:evidence-meta:v1';
const FETCH_MS    = 6000;          // hard ceiling per metadata fetch
const MAX_PERSIST = 200;           // cap the on-disk cache

const mem      = new Map();        // url -> meta (successes only)
const inFlight = new Map();        // url -> Promise<meta>
let hydrated = false;

// ── URL extraction & validation ─────────────────────────────────────────────

/** Pull the first real URL out of free-form text; normalise scheme. Returns
 *  a valid http(s) URL string, or null when nothing openable exists. */
export function extractUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const text = raw.trim();

  // 1. Explicit scheme anywhere in the string wins.
  const m = text.match(/https?:\/\/[^\s"'<>]+/i);
  let candidate = m ? m[0] : null;

  // 2. No scheme → accept "www.x.y" or bare "domain.tld/…" style strings.
  if (!candidate) {
    const d = text.match(/(?:^|\s)((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s"'<>]*)?)/i);
    if (d) candidate = `https://${d[1]}`;
  }
  if (!candidate) return null;

  // Strip trailing punctuation that rides along from prose ("…lab).", "…html,").
  candidate = candidate.replace(/[).,;\]']+$/, '');

  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Bare registrable-ish domain for display ("www." stripped). */
export function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./i, ''); }
  catch { return null; }
}

/** Favicon URL via Google's public favicon endpoint (renders through
 *  expo-image with an icon fallback — never a broken image). */
export const faviconFor = (url) => {
  const d = getDomain(url);
  return d ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64` : null;
};

// ── Cache plumbing ──────────────────────────────────────────────────────────

const hydrate = async () => {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (raw) {
      for (const [url, meta] of Object.entries(JSON.parse(raw))) {
        if (meta && meta.ok) mem.set(url, meta);
      }
    }
  } catch { /* best-effort */ }
};

let persistTimer = null;
const persistSoon = () => {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      const entries = [...mem.entries()].filter(([, m]) => m.ok).slice(-MAX_PERSIST);
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch { /* best-effort */ }
  }, 600);
};

// ── Title decoding helpers ──────────────────────────────────────────────────

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—' };
const decodeEntities = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&([a-z]+);/gi, (_, name) => ENTITIES[name.toLowerCase()] ?? `&${name};`);

// ── Public API ──────────────────────────────────────────────────────────────

/** Cached synchronous peek (no network). */
export function peekMeta(url) {
  return mem.get(url) || null;
}

/**
 * Resolve metadata for an already-validated http(s) URL.
 * Always resolves (never throws): { title, domain, favicon, ok }.
 */
export async function getMeta(url) {
  const domain  = getDomain(url);
  const favicon = faviconFor(url);
  const fallback = { title: null, domain, favicon, ok: false };
  if (!domain) return fallback;

  await hydrate();
  if (mem.has(url)) return mem.get(url);
  if (inFlight.has(url)) return inFlight.get(url);

  const p = (async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { Accept: 'text/html,*/*' },
      });
      if (!res.ok) return fallback;
      const html = (await res.text()).slice(0, 120_000);
      // og:title beats <title> when present (cleaner, no site-suffix).
      const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
              || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
      const tt = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const rawTitle = (og?.[1] || tt?.[1] || '').replace(/\s+/g, ' ').trim();
      const title = rawTitle ? decodeEntities(rawTitle).slice(0, 140) : null;

      const meta = { title, domain, favicon, ok: true };
      mem.set(url, meta);
      persistSoon();
      return meta;
    } catch {
      return fallback;              // not cached → Retry refetches for real
    } finally {
      clearTimeout(t);
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, p);
  return p;
}

export default { extractUrl, getDomain, faviconFor, getMeta, peekMeta };
