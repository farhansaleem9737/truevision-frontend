// truevision/services/youtubeService.js
//
// Curated YouTube source for the Discover/educational feed.
// Hits the public YouTube Data v3 search endpoint with safe-search strict,
// short-duration, embeddable filters, then layers two more passes of strict
// keyword filtering (allow-list + block-list) so only informative content
// reaches the UI.
//
// PLAYBACK NOTE: YouTube does not expose direct video file URLs. Items
// returned here cannot be streamed by `expo-video`. Consumers must either:
//   (a) tap → `Linking.openURL(item.videoUrl)` to open in the YouTube app, or
//   (b) render an embedded iframe player (e.g. react-native-youtube-iframe).
//
// SECURITY: EXPO_PUBLIC_* env vars ship in the app bundle. For production use
// a backend proxy so the key isn't extractable from the APK.

const YT_API_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '';
const YT_BASE    = 'https://www.googleapis.com/youtube/v3/search';
const PER_PAGE   = 20;
const TIMEOUT_MS = 15000;

// ─────────────────────────────────────────────────────────────────────────────
// Curated query pool — only these queries are sent to YouTube.
// Random pick per request to keep results varied.
// ─────────────────────────────────────────────────────────────────────────────
const QUERY_POOL = [
  'programming tutorial short',
  'AI explained short',
  'technology education',
  'web development tips',
  'cybersecurity basics',
  'business tips short',
  'finance education',
  'Islamic reminder short',
  'motivational speech short',
  'productivity tips',
];

// ─────────────────────────────────────────────────────────────────────────────
// Keyword filters — applied to title + description after the API call.
// `allow` is permissive (any one match is enough); `block` is strict (any
// match disqualifies the video).
// ─────────────────────────────────────────────────────────────────────────────
const ALLOW_KEYWORDS = [
  'tutorial', 'learn', 'education', 'guide', 'explained', 'course',
  'tips', 'lecture', 'islamic', 'business', 'finance', 'technology',
  'ai', 'coding',
];

const BLOCK_KEYWORDS = [
  'song', 'music', 'dance', 'remix', 'prank', 'funny',
  'romance', 'love', 'vlog', 'fashion', 'model', 'viral',
];

const containsAny = (haystack, needles) =>
  needles.some((n) => haystack.includes(n.toLowerCase()));

if (!YT_API_KEY) {
  console.warn(
    '[youtubeService] EXPO_PUBLIC_YOUTUBE_API_KEY is not set — requests will fail. ' +
    'Add it to truevision/.env and restart Metro with `npx expo start -c`.'
  );
} else {
  console.log(`[youtubeService] API key loaded (length=${YT_API_KEY.length})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Low-level request via fetch + AbortController. RN's axios path has been
// known to throw cryptic Network Errors on certain Wi-Fi setups; fetch
// surfaces clearer failure messages.
// ─────────────────────────────────────────────────────────────────────────────
const buildUrl = (path, params) => {
  const qs = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `${path}?${qs}` : path;
};

const ytRequest = async (params) => {
  const url        = buildUrl(YT_BASE, { ...params, key: YT_API_KEY });
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
      throw new Error('Cannot reach googleapis.com — check your network.');
    }
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Adapter — YouTube search resource → internal feed-item shape.
// We tag with `source: 'youtube'` so consumers can branch on render/play paths.
// ─────────────────────────────────────────────────────────────────────────────
const pickThumbnail = (thumbs = {}) =>
  thumbs.maxres?.url || thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || '';

const adaptItem = (raw) => {
  const id = raw.id?.videoId;
  if (!id) return null;
  const sn = raw.snippet || {};
  return {
    id,
    _id:           `yt-${id}`,
    youtubeId:     id,
    source:        'youtube',
    title:         sn.title || '',
    description:   sn.description || '',
    channelName:   sn.channelTitle || '',
    publishedAt:   sn.publishedAt,
    thumbnail:     pickThumbnail(sn.thumbnails),
    thumbnailUrl:  pickThumbnail(sn.thumbnails),
    videoUrl:      `https://www.youtube.com/watch?v=${id}`,
    embedUrl:      `https://www.youtube.com/embed/${id}`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Strict filter pass — both allow-list (must contain at least one) AND
// block-list (must contain none) checked on the lower-cased title+description.
// ─────────────────────────────────────────────────────────────────────────────
const isInformative = (item) => {
  const haystack = `${item.title} ${item.description} ${item.channelName}`.toLowerCase();
  if (containsAny(haystack, BLOCK_KEYWORDS)) return false;
  return containsAny(haystack, ALLOW_KEYWORDS);
};

const pickRandomQuery = () =>
  QUERY_POOL[Math.floor(Math.random() * QUERY_POOL.length)];

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export const youtubeService = {
  /**
   * Fetch a page of informative shorts. The query is randomly chosen from the
   * curated pool. Pagination uses YouTube's `pageToken`.
   *
   * @param {object}  [opts]
   * @param {string}  [opts.pageToken]  YouTube pagination token (from previous response)
   * @param {string}  [opts.query]      Override: use this query instead of a random pick
   */
  getInformativeFeed: async ({ pageToken, query } = {}) => {
    try {
      const q = (query || pickRandomQuery()).trim();
      console.log(`[youtubeService] /search q="${q}" pageToken=${pageToken || '-'}`);

      const data = await ytRequest({
        part:            'snippet',
        type:            'video',
        videoDuration:   'short',
        videoEmbeddable: 'true',
        safeSearch:      'strict',
        maxResults:      PER_PAGE,
        q,
        pageToken,
      });

      const raw      = Array.isArray(data.items) ? data.items : [];
      const adapted  = raw.map(adaptItem).filter(Boolean);
      const filtered = adapted.filter(isInformative);

      console.log(`[youtubeService] ${raw.length} raw → ${adapted.length} adapted → ${filtered.length} informative`);

      return {
        success:       true,
        items:         filtered,
        query:         q,
        nextPageToken: data.nextPageToken || null,
        prevPageToken: data.prevPageToken || null,
        totalRaw:      raw.length,
        keptCount:     filtered.length,
      };
    } catch (err) {
      console.error('[youtubeService] feed error:', err.message);
      return { success: false, error: err.message, items: [] };
    }
  },

  /**
   * Free-form search with the same strict filters applied. The user-supplied
   * query is appended to a "tutorial education" qualifier so vague terms like
   * "AI" don't return music videos.
   */
  search: async (rawQuery, { pageToken } = {}) => {
    if (!rawQuery?.trim()) return { success: true, items: [], nextPageToken: null };
    const q = `${rawQuery.trim()} tutorial education`;
    return youtubeService.getInformativeFeed({ pageToken, query: q });
  },

  // Exposed for tests/debugging
  _isInformative: isInformative,
  _adaptItem:     adaptItem,
  _QUERY_POOL:    QUERY_POOL,
};

export default youtubeService;
