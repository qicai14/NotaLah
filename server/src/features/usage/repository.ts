import { pool } from '../../lib/pool';

/** Adds `n` to the counter only if the total stays within `cap`; true when it did. One statement, so it is atomic across instances. */
export async function addIfUnder(metric: string, period: string, n: number, cap: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO "USAGE_COUNTER_T" (ucn_metric, ucn_period, ucn_count)
     SELECT $1, $2, $3::BIGINT WHERE $3::BIGINT <= $4::BIGINT
     ON CONFLICT (ucn_metric, ucn_period) DO UPDATE SET ucn_count = "USAGE_COUNTER_T".ucn_count + $3::BIGINT
     WHERE "USAGE_COUNTER_T".ucn_count + $3::BIGINT <= $4::BIGINT`,
    [metric, period, n, cap],
  );
  return rowCount === 1;
}

/** Bytes held by every asset that still has a file, across all users. */
export async function storedBytes(): Promise<number> {
  const { rows } = await pool.query<{ used: string }>(
    `SELECT COALESCE(SUM(ast_bytes), 0)::BIGINT AS used FROM "ASSET_T" WHERE ast_status IN ('pending', 'processing', 'ready')`,
  );
  return Number(rows[0].used);
}

/** Counts for the given (metric, period) pairs, keyed by metric. */
export async function counts(metrics: string[], periods: string[]): Promise<Map<string, number>> {
  const { rows } = await pool.query<{ metric: string; count: string }>(
    `SELECT ucn_metric AS "metric", ucn_count AS "count" FROM "USAGE_COUNTER_T"
     WHERE (ucn_metric, ucn_period) IN (SELECT * FROM UNNEST($1::TEXT[], $2::TEXT[]))`,
    [metrics, periods],
  );
  return new Map(rows.map((r) => [r.metric, Number(r.count)]));
}
