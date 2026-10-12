/**
 * Token buckets kept in memory: the webapp server runs as one process, which
 * its liwi subscriptions already require.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface RateLimiterOptions {
  /** requests allowed at once, after a quiet period */
  capacity: number;
  refillPerSecond: number;
  now?: () => number;
}

export interface RateLimiter {
  /** takes one request; the seconds to wait when the bucket is empty */
  consume: (key: string) => number | undefined;
  /** the seconds to wait if the bucket is empty, without taking a request */
  retryAfter: (key: string) => number | undefined;
}

const sweepIntervalMs = 60_000;

export const createRateLimiter = ({
  capacity,
  refillPerSecond,
  now = Date.now,
}: RateLimiterOptions): RateLimiter => {
  const buckets = new Map<string, Bucket>();
  let lastSweepAt = now();

  const refilled = (bucket: Bucket, at: number): number =>
    Math.min(
      capacity,
      bucket.tokens + ((at - bucket.updatedAt) / 1000) * refillPerSecond,
    );

  // a full bucket is the same as no bucket: dropping them bounds the map to
  // the keys seen recently
  const sweep = (at: number): void => {
    if (at - lastSweepAt < sweepIntervalMs) return;
    lastSweepAt = at;
    for (const [key, bucket] of buckets) {
      if (refilled(bucket, at) >= capacity) buckets.delete(key);
    }
  };

  const currentTokens = (key: string, at: number): number => {
    const bucket = buckets.get(key);
    return bucket ? refilled(bucket, at) : capacity;
  };

  const waitFor = (tokens: number): number | undefined =>
    tokens >= 1 ? undefined : Math.ceil((1 - tokens) / refillPerSecond);

  return {
    consume: (key) => {
      const at = now();
      sweep(at);
      const tokens = currentTokens(key, at);
      const wait = waitFor(tokens);
      if (wait !== undefined) return wait;
      buckets.set(key, { tokens: tokens - 1, updatedAt: at });
      return undefined;
    },
    retryAfter: (key) => waitFor(currentTokens(key, now())),
  };
};
