// truevision/hooks/useReelPrefetch.js
//
// Smart preload for the vertical feed. When the active index changes it warms a
// SMALL window ahead of the user:
//   • upcoming video FILES → services/videoCache (played from disk = instant
//     start, and available after returning from the background)
//   • upcoming + one-previous THUMBNAILS → expo-image disk cache (never a blank
//     frame on swipe)
//
// It never preloads the whole feed — only `AHEAD` items (1 on data-saver /
// cellular, 2 otherwise). The cache is bounded (LRU) and de-duped, so this
// trades a little proactive bandwidth for TikTok-style instant playback while
// staying network-friendly.

import { useEffect } from 'react';
import { Image as ExpoImage } from 'expo-image';
import videoCache from '../services/videoCache';
import { buildFallbackChain } from '../utils/videoQuality';
import usePreferences from './usePreferences';
import useNetworkStatus from './useNetworkStatus';

export default function useReelPrefetch(list, activeIndex) {
  const { prefs } = usePreferences();
  const net = useNetworkStatus();

  useEffect(() => {
    if (!Array.isArray(list) || list.length === 0 || activeIndex == null || activeIndex < 0) return;

    const dataSaverPref = prefs?.content?.dataSaver === true;
    const hdOnWifiPref  = prefs?.content?.hdOnWifi !== false;
    const effectiveDataSaver = dataSaverPref || (hdOnWifiPref && net.isCellular);
    const AHEAD = effectiveDataSaver ? 1 : 2;

    const videoUrls = [];
    const thumbUrls = [];

    for (let i = activeIndex + 1; i <= activeIndex + AHEAD && i < list.length; i++) {
      const it = list[i];
      if (!it) continue;
      const chain = buildFallbackChain(it, { dataSaver: effectiveDataSaver });
      if (chain[0]) videoUrls.push(chain[0]);   // the rung the card will actually try first
      if (it.thumbnailUrl) thumbUrls.push(it.thumbnailUrl);
    }
    // Warm the previous thumbnail too, for a smooth scroll-back.
    const prev = list[activeIndex - 1];
    if (prev?.thumbnailUrl) thumbUrls.push(prev.thumbnailUrl);

    // Cancel/pause any in-flight video prefetch that's no longer in the warm
    // window (user scrolled past it) so we stop wasting bandwidth. Keep the
    // ACTIVE video's URL warm too — it may still be downloading for the player.
    const keep = [...videoUrls];
    const cur = list[activeIndex];
    if (cur) {
      const curChain = buildFallbackChain(cur, { dataSaver: effectiveDataSaver });
      if (curChain[0]) keep.push(curChain[0]);
    }
    videoCache.keepOnly(keep);

    if (videoUrls.length) videoCache.prefetchMany(videoUrls);
    if (thumbUrls.length) { try { ExpoImage.prefetch(thumbUrls); } catch (_) { /* best-effort */ } }
  }, [list, activeIndex, prefs?.content?.dataSaver, prefs?.content?.hdOnWifi, net.isCellular]);
}
