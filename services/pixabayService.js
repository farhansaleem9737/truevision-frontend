// truevision/services/pixabayService.js
//
// Curated Pixabay Video source for the Trending feed. Fetches stock mp4s that
// stream natively in expo-video (unlike YouTube). Layers two passes of strict
// keyword filtering on top of the API so only informative content reaches UI.
//
// SECURITY: EXPO_PUBLIC_* env vars ship in the JS bundle. For production,
// proxy through your backend so the key isn't extractable from the APK.

const PIXABAY_API_KEY = process.env.EXPO_PUBLIC_PIXABAY_API_KEY || '';
const PIXABAY_BASE    = 'https://pixabay.com/api/videos/';
const PER_PAGE        = 20;
const TIMEOUT_MS      = 15000;

// ─────────────────────────────────────────────────────────────────────────────
// Curated query pool — only these queries are sent. Randomised per request so
// the feed feels varied without ever drifting into entertainment content.
// ─────────────────────────────────────────────────────────────────────────────
const QUERY_POOL = [
  'programming',
  'technology',
  'education',
  'tutorial',
  'coding',
  'AI',
  'machine learning',
  'business',
  'finance',
  'productivity',
  'islamic lecture',
  'motivation',
];

// ─────────────────────────────────────────────────────────────────────────────
// Keyword filters — applied to tags + the query that fetched the item.
// ALLOW: at least one match required. BLOCK: any match disqualifies.
// ─────────────────────────────────────────────────────────────────────────────
const ALLOW_KEYWORDS = [
  'education', 'technology', 'tutorial', 'learning', 'business',
  'finance', 'coding', 'ai', 'training', 'lecture',
  // Pixabay's tags often use these adjacent terms — accept them too
  'computer', 'programming', 'science', 'data', 'machine',
  'office', 'study', 'school', 'lesson', 'productivity',
  'motivation', 'islamic', 'mosque', 'quran',
];

const BLOCK_KEYWORDS = [
  'music', 'dance', 'fashion', 'model', 'romance', 'funny',
  'entertainment', 'party', 'viral',
];

const containsAny = (haystack, needles) =>
  needles.some((n) => haystack.includes(n.toLowerCase()));

if (!PIXABAY_API_KEY) {
  console.warn(
    '[pixabayService] EXPO_PUBLIC_PIXABAY_API_KEY is not set — requests will fail. ' +
    'Get a free key at https://pixabay.com/api/docs/ and add it to truevision/.env, then `npx expo start -c`.'
  );
} else {
  console.log(`[pixabayService] API key loaded (length=${PIXABAY_API_KEY.length})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helper — fetch + AbortController, with friendly error messages.
// ─────────────────────────────────────────────────────────────────────────────
const buildUrl = (path, params) => {
  const qs = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `${path}?${qs}` : path;
};

const pixabayRequest = async (params) => {
  const url        = buildUrl(PIXABAY_BASE, { ...params, key: PIXABAY_API_KEY });
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      let snippet = '';
      try { snippet = (await res.text()).slice(0, 160); } catch {}
      throw new Error(`HTTP ${res.status}${snippet ? ` — ${snippet}` : ''}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out — check your internet connection.');
    }
    if (err.message?.includes('Network request failed')) {
      throw new Error('Cannot reach pixabay.com — check your network.');
    }
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Quality picker — Pixabay returns up to 4 tiers per video:
//   large  (typically 1920×1080)
//   medium (typically 1280×720)
//   small  (typically 960×540)
//   tiny   (typically 640×360)
// Prefer ≥720p for sharp playback; drop to medium in data-saver mode.
// ─────────────────────────────────────────────────────────────────────────────
export const pickVideoFile = (videos = {}, opts = {}) => {
  const { dataSaver = false } = opts;

  const tryTiers = (tiers) => {
    for (const t of tiers) {
      const v = videos[t];
      if (v?.url && (v.size === undefined || v.size > 0)) return v;
    }
    return null;
  };

  if (dataSaver) return tryTiers(['medium', 'small', 'tiny', 'large']);
  // Default — sharpest available, cap at large (1080p)
  return tryTiers(['medium', 'large', 'small', 'tiny'])
      || tryTiers(['large', 'medium', 'small', 'tiny']);
};

// ─────────────────────────────────────────────────────────────────────────────
// Adapter — Pixabay video object → our internal feed-item shape.
// Tags are real Pixabay metadata (no mock data). Counts use real Pixabay
// engagement numbers; if a creator hasn't filled them in they default to 0.
// ─────────────────────────────────────────────────────────────────────────────
const adaptItem = (raw, queryUsed) => {
  const file = pickVideoFile(raw.videos);
  if (!file?.url) return null;

  const tags     = (raw.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
  const username = (raw.user || 'pixabay').toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._]/g, '');

  return {
    _id:          `pixabay-${raw.id}`,
    id:           `pixabay-${raw.id}`,
    pixabayId:    raw.id,
    source:       'pixabay',
    queryUsed,    // for diagnostics — which curated query brought it in

    videoUrl:     file.url,
    videoQuality: file.height ? `${file.height}p` : 'unknown',
    thumbnail:    file.thumbnail || raw.videos?.large?.thumbnail || raw.videos?.medium?.thumbnail || '',
    thumbnailUrl: file.thumbnail || raw.videos?.large?.thumbnail || raw.videos?.medium?.thumbnail || '',
    width:        file.width,
    height:       file.height,
    isVertical:   (file.height || 0) > (file.width || 0),
    duration:     raw.duration || 0,
    tags,

    pixabayUrl:   raw.pageURL,

    // Creator (real Pixabay uploader info — no mocks)
    userId: {
      _id:          `pixabay-user-${raw.user_id || raw.id}`,
      username,
      fullName:     raw.user || '',
      profileImage: raw.userImageURL || null,
      isVerified:   false,
    },

    description:   '',
    song:          '',

    // Real engagement metrics from Pixabay
    likesCount:    raw.likes || 0,
    commentsCount: raw.comments || 0,
    sharesCount:   0,
    savesCount:    0,
    viewsCount:    raw.views || 0,
    downloadsCount:raw.downloads || 0,

    isLiked:     false,
    isSaved:     false,
    isFollowing: false,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Strict filter — must satisfy allow-list AND not hit block-list.
// Inputs scanned: tags + the query that fetched this item.
// ─────────────────────────────────────────────────────────────────────────────
const isInformative = (item) => {
  const haystack = `${(item.tags || []).join(' ')} ${item.queryUsed || ''} ${item.userId?.fullName || ''}`.toLowerCase();
  if (containsAny(haystack, BLOCK_KEYWORDS)) return false;
  return containsAny(haystack, ALLOW_KEYWORDS);
};

// Vertical-first sort so portrait reels land near the top of the feed
const verticalFirst = (items) => {
  const v = [], h = [];
  items.forEach((i) => (i.isVertical ? v.push(i) : h.push(i)));
  return [...v, ...h];
};

const pickRandomQuery = () =>
  QUERY_POOL[Math.floor(Math.random() * QUERY_POOL.length)];

// ─────────────────────────────────────────────────────────────────────────────
// Public API — same shape as the old pexelsService consumers expect.
// ─────────────────────────────────────────────────────────────────────────────
export const pixabayService = {
  /**
   * Fetch a page of curated informative videos. Random query per call.
   *
   * @param {number} [page=1]      Pixabay paginates by 1-indexed `page`
   * @param {object} [opts]
   * @param {string} [opts.query]  Override the random query
   */
  getInformativeFeed: async (page = 1, { query } = {}) => {
    try {
      const q = (query || pickRandomQuery()).trim();
      console.log(`[pixabayService] /videos q="${q}" page=${page} per_page=${PER_PAGE}`);

      const data = await pixabayRequest({
        q,
        per_page: PER_PAGE,
        page,
        safesearch: 'true',
      });

      const raw      = Array.isArray(data.hits) ? data.hits : [];
      const adapted  = raw.map((r) => adaptItem(r, q)).filter(Boolean);
      const filtered = adapted.filter(isInformative);

      console.log(`[pixabayService] ${raw.length} raw → ${adapted.length} adapted → ${filtered.length} informative`);
      if (filtered[0]) console.log(`[pixabayService] sample: ${filtered[0].videoQuality} ${filtered[0].videoUrl.slice(0, 60)}…`);

      return {
        success: true,
        items:   verticalFirst(filtered),
        page,
        hasMore: page * PER_PAGE < (data.totalHits || 0),
        totalHits: data.totalHits || 0,
        query: q,
      };
    } catch (err) {
      // warn (not error) so RN LogBox doesn't pop up over the screen — the
      // caller already shows a dismissible banner when success === false.
      console.warn('[pixabayService] feed unavailable:', err.message);
      return { success: false, error: err.message, items: [] };
    }
  },

  /**
   * Free-form search with the same allow/block filters applied.
   * The user query is appended to a "tutorial education" qualifier so
   * vague terms like "AI" don't return music videos.
   */
  search: async (rawQuery, page = 1) => {
    if (!rawQuery?.trim()) return { success: true, items: [], page: 1, hasMore: false };
    return pixabayService.getInformativeFeed(page, { query: `${rawQuery.trim()} tutorial` });
  },

  // Legacy alias so HomeScreen's existing `pexelsService.getPopular(page)` call
  // can be drop-in replaced.
  getPopular: (page = 1) => pixabayService.getInformativeFeed(page),

  // Exposed for tests/debugging
  _isInformative: isInformative,
  _adaptItem:     adaptItem,
  _QUERY_POOL:    QUERY_POOL,
};

export default pixabayService;
