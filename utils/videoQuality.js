// truevision/utils/videoQuality.js
//
// Pick the right video URL based on:
//   - the item's `qualities` object (Cloudinary pre-encoded ladder for own uploads)
//   - the user's data-saver / HD-on-Wi-Fi preferences
//
// Why this exists: the original `videoUrl` for an own upload is the raw
// Cloudinary file — often 4K and tens of MB. Streaming that to a phone burns
// bandwidth and stalls playback. Cloudinary already produced 144/240/360/480/720
// transcodes at upload time; this helper picks the right rung of that ladder.
//
// External imports (Pixabay) ship a single pre-picked URL in `videoUrl` and
// have no `qualities` ladder, so the fallback at the bottom handles them.

const TIER_NORMAL    = ['720p', '480p', '360p'];   // fast start on Wi-Fi/4G
const TIER_DATASAVER = ['360p', '480p', '240p'];   // smallest playable

const pickFromLadder = (qualities, tier) => {
  if (!qualities) return null;
  for (const q of tier) {
    if (qualities[q]) return qualities[q];
  }
  // Last-ditch: any populated rung
  for (const q of ['480p', '360p', '720p', '240p', '144p']) {
    if (qualities[q]) return qualities[q];
  }
  return null;
};

/**
 * Pick the best playable URL for a feed item.
 *
 * @param {object} item    - Video item (own upload or external import)
 * @param {object} [opts]
 * @param {boolean} [opts.dataSaver]  - prefer the smallest tier
 * @returns {string} URL
 */
export const pickVideoUrl = (item, opts = {}) => {
  if (!item) return '';

  const tier = opts.dataSaver ? TIER_DATASAVER : TIER_NORMAL;
  const fromLadder = pickFromLadder(item.qualities, tier);
  if (fromLadder) return fromLadder;

  // No qualities ladder — fall back to the original.
  return item.videoUrl || item.uri || '';
};
