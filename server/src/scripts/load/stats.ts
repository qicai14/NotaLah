/** Nearest-rank percentile (p in 0..100) of unsorted values; NaN for an empty list. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

export interface Summary {
  count: number;
  errors: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface Sample {
  ms: number;
  ok: boolean;
}

export function summarise(samples: readonly Sample[]): Summary {
  const ms = samples.map((s) => s.ms);
  const errors = samples.filter((s) => !s.ok).length;
  return {
    count: samples.length,
    errors,
    errorRate: samples.length ? errors / samples.length : 0,
    p50: percentile(ms, 50),
    p95: percentile(ms, 95),
    p99: percentile(ms, 99),
    max: percentile(ms, 100),
  };
}

/** IR NFR1: search results within 3 seconds under normal load; the pass test is search p95 under the limit with no search errors. */
export const NFR1_LIMIT_MS = 3000;

export function nfr1Verdict(search: Summary): { pass: boolean; allUnderLimit: boolean } {
  return {
    pass: search.count > 0 && search.p95 < NFR1_LIMIT_MS && search.errors === 0,
    allUnderLimit: search.count > 0 && search.max < NFR1_LIMIT_MS,
  };
}
