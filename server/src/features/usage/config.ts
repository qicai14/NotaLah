import { logger } from '../../lib/logger';

/** Free-tier allowances (R34, D57). Storage is decimal gigabytes, the smaller reading of "10 GB-month". */
export const FREE = Object.freeze({
  storageBytes: 10_000_000_000,
  classA: 1_000_000,
  classB: 10_000_000,
  unsplash: 50,
});

/**
 * Share of each allowance the app may use. Monthly R2 caps are 50% until the billing period is confirmed as the UTC
 * calendar month (D57); a cycle spanning two calendar months then still stays under the allowance.
 */
export const SHARE = Object.freeze({ storage: 0.8, classA: 0.5, classB: 0.5, unsplash: 0.5 });

/** A cap from the environment. It can lower the default, never raise it: a higher or unusable value falls back to the default. */
export function capFromEnv(
  name: string,
  free: number,
  share: number,
  raw: string | undefined = process.env[name],
): number {
  const fallback = Math.floor(free * share);
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    logger.warn({ name, raw }, 'usage cap is not a whole number, using the default');
    return fallback;
  }
  if (n > fallback) {
    logger.warn({ name, raw, default: fallback }, 'usage cap is above the safe default, using the default');
    return fallback;
  }
  return n;
}

export type Period = 'month' | 'hour' | 'day';

/** Counted metrics. A daily AI metric is a new entry with `period: 'day'`. */
export const METRICS = Object.freeze({
  class_a: {
    period: 'month' as Period,
    cap: capFromEnv('USAGE_CAP_CLASS_A', FREE.classA, SHARE.classA),
  },
  class_b: {
    period: 'month' as Period,
    cap: capFromEnv('USAGE_CAP_CLASS_B', FREE.classB, SHARE.classB),
  },
  unsplash: {
    period: 'hour' as Period,
    cap: capFromEnv('USAGE_CAP_UNSPLASH', FREE.unsplash, SHARE.unsplash),
  },
});
export type Metric = keyof typeof METRICS;

/** Total bytes of live assets across all users. Not a counter: the assets table is the source. */
export const STORAGE_CAP_BYTES = capFromEnv('USAGE_CAP_STORAGE_BYTES', FREE.storageBytes, SHARE.storage);
