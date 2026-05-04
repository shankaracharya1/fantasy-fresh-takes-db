/**
 * Shared in-memory response cache.
 *
 * Fluid Compute reuses function instances across requests, so module-level
 * state persists between calls on the SAME instance. This gives near-zero
 * latency for repeat requests without any external storage dependency.
 *
 * Cleared by evictInMemoryResponseCache(), called from /api/dashboard/refresh-cache
 * when the user clicks the Sync button.
 */

const _cache = new Map(); // cacheKey → { cachedAt: number, payload: object }
const RESPONSE_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function readInMemResponseCache(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > RESPONSE_CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.payload;
}

export function writeInMemResponseCache(key, payload) {
  _cache.set(key, { cachedAt: Date.now(), payload });
}

export function evictInMemoryResponseCache() {
  _cache.clear();
}
