// truevision/hooks/useCachedResource.js
//
// Offline-first data hook for read-only resources (app info, legal docs,
// changelog). Behaviour:
//   1. Immediately serve any cached copy from AsyncStorage (instant paint).
//   2. Fetch fresh data from the network; on success, update + re-cache.
//   3. On failure, keep the cached copy and expose an error only if there was
//      nothing cached to fall back to.
//
// Returns: { data, loading, refreshing, error, fromCache, offline, refetch }
//
//   loading    — first load with no cached data yet (show a skeleton)
//   refreshing — a refetch while data is already on screen (show a spinner)
//   fromCache  — the visible data came from cache, not this session's network
//   offline    — device currently has no connectivity
//   error      — set only when we have NOTHING to show (cache miss + net fail)

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useNetworkStatus from './useNetworkStatus';

const PREFIX = '@truevision:cache:';

export default function useCachedResource(key, fetcher, { pickData } = {}) {
  const cacheKey = PREFIX + key;
  const net = useNetworkStatus();

  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);
  const [fromCache, setFromCache] = useState(false);

  const mounted = useRef(true);
  // Keep the latest fetcher without making it a dependency (callers often pass
  // an inline arrow — we don't want to re-run on every render).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const pickRef = useRef(pickData);
  pickRef.current = pickData;

  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async ({ isRefetch } = {}) => {
    // 1. Seed from cache (only on the very first load, so a manual refetch
    //    doesn't flash stale content over what's already shown).
    if (!isRefetch) {
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (raw && mounted.current) {
          const cached = JSON.parse(raw);
          setData(cached);
          setFromCache(true);
          setLoading(false); // we have something to show
        }
      } catch (_) { /* corrupt cache — ignore */ }
    }

    if (isRefetch) setRefreshing(true);

    // 2. Network fetch.
    try {
      const res = await fetcherRef.current();
      if (!mounted.current) return;

      if (res && res.success !== false) {
        const picked = pickRef.current ? pickRef.current(res) : res;
        setData(picked);
        setFromCache(false);
        setError(null);
        AsyncStorage.setItem(cacheKey, JSON.stringify(picked)).catch(() => {});
      } else {
        // Server responded but with an error envelope.
        setError((prev) => (data ? prev : (res?.message || 'Something went wrong')));
      }
    } catch (_) {
      if (mounted.current) {
        setError((prev) => (data ? prev : 'Network error'));
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [cacheKey, data]);

  useEffect(() => { load(); }, [cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(() => load({ isRefetch: true }), [load]);

  return {
    data,
    loading,
    refreshing,
    error,
    fromCache,
    offline: net.isConnected === false || net.isInternetReachable === false,
    refetch,
  };
}
