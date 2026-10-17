import { logger } from '../../lib/logger';

/** Free-tier allowances (R34, D57). Storage is decimal gigabytes, the smaller reading of "10 GB-month". */
export const FREE = Object.freeze({
  storageBytes: 10_000_000_000,
  classA: 1_000_000,
  classB: 10_000_000,
  unsplash: 50,
});

/** The app stops at this share of each allowance, leaving room for uncounted calls and races. */
export const SAFETY = 0.8;

/** A cap from the environment, never above the free figure; unusable values fall back to the default. */
export function capFromEnv(name: string, free: number, raw: string | undefined = process.env[name]): number {
  const fallback = Math.floor(free * SAFETY);
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    logger.warn({ name, raw }, 'usage cap is not a whole number, using the default');
    return fallback;
  }
  if (n > free) {
    logger.warn({ name, raw, free }, 'usage cap is above the free allowance, clamped to it');
    return free;
  }
  return n;
}

export type Period = 'month' | 'hour' | 'day';

/** Counted metrics. A daily AI metric is a new entry with `period: 'day'`. */
export const METRICS = Object.freeze({
  class_a: {
    period: 'month' as Period,
    cap: capFromEnv('USAGE_CAP_CLASS_A', FREE.classA),
  },
  class_b: {
    period: 'month' as Period,
    cap: capFromEnv('USAGE_CAP_CLASS_B', FREE.classB),
  },
  unsplash: {
    period: 'hour' as Period,
    cap: capFromEnv('USAGE_CAP_UNSPLASH', FREE.unsplash),
  },
});
export type Metric = keyof typeof METRICS;

/** Total bytes of live assets across all users. Not a counter: the assets table is the source. */
export const STORAGE_CAP_BYTES = capFromEnv('USAGE_CAP_STORAGE_BYTES', FREE.storageBytes);
