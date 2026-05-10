// truevision/services/pexelsService.js
//
// Pexels Video API client.
// Uses fetch (not axios) — RN's axios path has been seen to throw "Network Error"
// with no status on some Wi-Fi setups. fetch gives clearer diagnostics.
//
// SECURITY: EXPO_PUBLIC_* env vars are bundled into the JS bundle and can be
// extracted from a built APK. For real production, proxy these calls through
// your backend so the API key never ships to the client.

const PEXELS_API_KEY = process.env.EXPO_PUBLIC_PEXELS_API_KEY || '';
const API_BASE       = 'https://api.pexels.com/videos';
const PER_PAGE       = 20;
const REQUEST_TIMEOUT_MS = 15000;

if (!PEXELS_API_KEY) {
  console.warn('[pexelsService] EXPO_PUBLIC_PEXELS_API_KEY is not set — requests will 401. Add it to truevision/.env and restart Metro with `npx expo start -c`.');
} else {
  console.log(`[pexelsService] API key loaded (length=${PEXELS_API_KEY.length}, first 6=${PEXELS_API_KEY.slice(0, 6)}…)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Low-level request — fetch + AbortController for timeout, normalised errors.
// ─────────────────────────────────────────────────────────────────────────────
const buildUrl = (path, params) => {
  const qs = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `${API_BASE}${path}?${qs}` : `${API_BASE}${path}`;
};

const pexelsRequest = async (path, params) => {
  const url        = buildUrl(path, params);
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method:  'GET',
      headers: { Authorization: PEXELS_API_KEY, Accept: 'application/json' },
      signal:  controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const snippet = body.slice(0, 120).replace(/\s+/g, ' ');
      throw new Error(`HTTP ${res.status}${snippet ? ` — ${snippet}` : ''}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out — check your internet connection.');
    }
    // RN sometimes throws TypeError("Network request failed") when DNS / TLS / connectivity fails.
    if (err.message?.includes('Network request failed')) {
      throw new Error('Cannot reach api.pexels.com — your network may block external sites or be offline.');
    }
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Video file picker — fast-start oriented.
// On mobile reels you can't tell 720p from 1080p, but the 1080p file is roughly
// 2x larger and takes much longer to begin playing. Default target is 720p with
// a graceful fall-back. Data saver targets ~480p.
// ─────────────────────────────────────────────────────────────────────────────
const pickAroundTarget = (sorted, target, lowerBound) => {
  const atOrBelow = sorted
    .filter((f) => (f.height || 0) <= target)
    .sort((a, b) => (b.height || 0) - (a.height || 0));
  if (atOrBelow.length && (atOrBelow[0].height || 0) >= lowerBound) return atOrBelow[0];

  const okay = sorted.filter((f) => (f.height || 0) >= lowerBound);
  if (okay.length) return okay[okay.length - 1];

  return sorted[sorted.length - 1] || sorted[0];
};

export const pickVideoFile = (files = [], opts = {}) => {
  if (!files.length) return null;
  const mp4s = files.filter((f) => /mp4/i.test(f.file_type || '') && f.link);
  const pool = mp4s.length ? mp4s : files;
  const sorted = [...pool].sort((a, b) => (b.height || 0) - (a.height || 0));

  if (opts.dataSaver) return pickAroundTarget(sorted, 480, 240);
  return pickAroundTarget(sorted, 720, 360);
};

// ─────────────────────────────────────────────────────────────────────────────
// Adapter — Pexels response → shape ReelCard consumes.
// NO MOCK DATA. Every field comes from the real Pexels payload or is left empty.
// Counts default to 0 because Pexels does not expose engagement metrics.
// ─────────────────────────────────────────────────────────────────────────────
export const adaptToReelItem = (pv) => {
  const file = pickVideoFile(pv.video_files);

  // Real creator info from Pexels — `pv.user.name` is the photographer's name.
  // No avatar is provided by Pexels; the ReelCard renders an initials fallback.
  const realName = pv.user?.name?.trim() || '';
  const username = realName
    ? realName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._]/g, '')
    : 'pexels';

  return {
    _id:       `pexels-${pv.id}`,
    id:        `pexels-${pv.id}`,
    pexelsId:  pv.id,
    source:    'pexels',

    videoUrl:     file?.link || '',
    videoQuality: file ? `${file.height || '?'}p` : 'unknown',
    thumbnailUrl: pv.image,
    width:        pv.width,
    height:       pv.height,
    duration:     pv.duration,
    isVertical:   (pv.height || 0) > (pv.width || 0),
    pexelsUrl:    pv.url,

    userId: {
      _id:          `pexels-user-${pv.user?.id || pv.id}`,
      username,
      fullName:     realName,
      profileImage: null,        // Pexels has no avatars
      isVerified:   false,
    },

    description:   '',           // Pexels has no caption
    song:          '',           // Pexels has no audio track metadata
    likesCount:    0,
    commentsCount: 0,
    sharesCount:   0,
    savesCount:    0,

    isLiked:     false,
    isSaved:     false,
    isFollowing: false,
  };
};

// Sort: vertical (portrait) first, preserve original order within each group.
const verticalFirst = (items) => {
  const v = [], h = [];
  items.forEach((i) => (i.isVertical ? v.push(i) : h.push(i)));
  return [...v, ...h];
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export const pexelsService = {
  getPopular: async (page = 1) => {
    try {
      console.log(`[pexelsService] GET /popular page=${page} per_page=${PER_PAGE}`);
      const data = await pexelsRequest('/popular', { per_page: PER_PAGE, page, min_width: 720 });
      const raw   = data.videos || [];
      const items = raw.map(adaptToReelItem).filter((v) => v.videoUrl);
      console.log(`[pexelsService] /popular ← ${raw.length} raw, ${items.length} playable, hasMore=${!!data.next_page}`);
      return {
        success: true,
        items: verticalFirst(items),
        page: data.page || page,
        hasMore: !!data.next_page,
      };
    } catch (err) {
      console.error('[pexelsService] /popular error:', err.message);
      return { success: false, error: err.message, items: [] };
    }
  },

  search: async (query, page = 1) => {
    if (!query?.trim()) return { success: true, items: [], page: 1, hasMore: false };
    try {
      console.log(`[pexelsService] GET /search query="${query}" page=${page}`);
      const data = await pexelsRequest('/search', {
        query: query.trim(), per_page: PER_PAGE, page, orientation: 'portrait', min_width: 720,
      });
      const raw   = data.videos || [];
      const items = raw.map(adaptToReelItem).filter((v) => v.videoUrl);
      console.log(`[pexelsService] /search ← ${raw.length} raw, ${items.length} playable, hasMore=${!!data.next_page}`);
      return {
        success: true,
        items: verticalFirst(items),
        page: data.page || page,
        hasMore: !!data.next_page,
      };
    } catch (err) {
      console.error('[pexelsService] /search error:', err.message);
      return { success: false, error: err.message, items: [] };
    }
  },

  getById: async (pexelsId) => {
    try {
      const data = await pexelsRequest(`/videos/${pexelsId}`, {});
      return { success: true, item: adaptToReelItem(data) };
    } catch (err) {
      console.error('[pexelsService] getById error:', err.message);
      return { success: false, error: err.message };
    }
  },
};

export default pexelsService;
