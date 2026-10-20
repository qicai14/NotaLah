import { METRICS, STORAGE_CAP_BYTES, type Metric, type Period } from './config';
import { addIfUnder, counts, storedBytes } from './repository';

export class UsageLimitError extends Error {}

/** UTC period key: '2026-10', '2026-10-18' or '2026-10-18T14'. */
export function periodKey(period: Period, now = new Date()): string {
  return now.toISOString().slice(0, { month: 7, day: 10, hour: 13 }[period]);
}

/** True and counted when the metric's total for the current period stays within `cap`; false and uncounted otherwise. */
export function consume(metric: Metric, n = 1, cap: number = METRICS[metric].cap, now = new Date()): Promise<boolean> {
  return addIfUnder(metric, periodKey(METRICS[metric].period, now), n, cap);
}

/** Adds the bytes just sent from storage to this month's total. Never refuses: the cap only stops later video requests. */
export const recordServed = (bytes: number) => consume('served_bytes', bytes, Number.MAX_SAFE_INTEGER);

/** True once this month's served bytes have reached the cap. */
export async function servedBytesReached(now = new Date()): Promise<boolean> {
  const { period, cap } = METRICS.served_bytes;
  return ((await counts(['served_bytes'], [periodKey(period, now)])).get('served_bytes') ?? 0) >= cap;
}

/** Like `consume`, but throws when the cap is reached. */
export async function consumeOrThrow(metric: Metric, message: string): Promise<void> {
  if (!(await consume(metric))) throw new UsageLimitError(message);
}

/**
 * shortcut: read-then-write, so concurrent uploads can each pass and overshoot by their combined size (up to a few
 * 50 MB videos at once); the 2 GB headroom under the 10 GB allowance absorbs it. Use an atomic reserve if uploads grow.
 * True when a new file of `bytes` still fits under the global storage cap.
 */
export async function storageFits(bytes: number): Promise<boolean> {
  return (await storedBytes()) + bytes <= STORAGE_CAP_BYTES;
}

interface UsageRow {
  metric: string;
  used: number;
  cap: number;
  period: string;
}

export async function usageReport(): Promise<UsageRow[]> {
  const entries = Object.entries(METRICS) as [Metric, (typeof METRICS)[Metric]][];
  const periods = entries.map(([, d]) => periodKey(d.period));
  const used = await counts(
    entries.map(([m]) => m),
    periods,
  );
  return [
    ...entries.map(([metric, d], i) => ({
      metric,
      used: used.get(metric) ?? 0,
      cap: d.cap,
      period: periods[i],
    })),
    {
      metric: 'storage_bytes',
      used: await storedBytes(),
      cap: STORAGE_CAP_BYTES,
      period: 'total',
    },
  ];
}
