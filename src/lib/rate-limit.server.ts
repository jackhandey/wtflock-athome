/**
 * In-memory sliding window rate limiter for server API endpoints.
 * Thread/isolate safe within a single server instance.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetInMs: number;
}

const hits = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 10_000;

/**
 * Checks whether a given identifier has exceeded the allowed request limit within the sliding time window.
 *
 * @param key Unique key to rate limit on (e.g. device key ID or IP)
 * @param limit Maximum allowed requests in window (default 60)
 * @param windowMs Duration of the sliding window in milliseconds (default 60,000ms = 1m)
 */
export function checkRateLimit(key: string, limit = 60, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Prune map if tracked keys grow too large to prevent memory leaks
  if (hits.size > MAX_TRACKED_KEYS) {
    for (const [k, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => t > windowStart);
      if (valid.length === 0) {
        hits.delete(k);
      } else {
        hits.set(k, valid);
      }
    }
  }

  const existing = hits.get(key) ?? [];
  const validTimestamps = existing.filter((t) => t > windowStart);

  if (validTimestamps.length >= limit) {
    const oldest = validTimestamps[0] ?? now;
    const resetInMs = Math.max(0, oldest + windowMs - now);
    return {
      success: false,
      limit,
      remaining: 0,
      resetInMs,
    };
  }

  validTimestamps.push(now);
  hits.set(key, validTimestamps);

  const oldest = validTimestamps[0] ?? now;
  const resetInMs = Math.max(0, oldest + windowMs - now);

  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - validTimestamps.length),
    resetInMs,
  };
}

/**
 * Clear rate limit records (useful for testing).
 */
export function resetRateLimits(): void {
  hits.clear();
}
