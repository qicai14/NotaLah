import { pool } from '../../lib/pool';

/** Counts one hit for `key` in its fixed window, starting a new window when the old one has passed (D40). */
export async function hitRateLimit(key: string, windowMs: number): Promise<{ totalHits: number; resetTime: Date }> {
  const { rows } = await pool.query<{ totalHits: number; resetTime: Date }>(
    `INSERT INTO "RATE_LIMIT_T" AS r (rlt_key, rlt_window_start, rlt_hits) VALUES ($1, NOW(), 1)
     ON CONFLICT (rlt_key) DO UPDATE
       SET rlt_hits = CASE WHEN r.rlt_window_start <= NOW() - $2::INT * INTERVAL '1 millisecond' THEN 1 ELSE r.rlt_hits + 1 END,
           rlt_window_start = CASE WHEN r.rlt_window_start <= NOW() - $2::INT * INTERVAL '1 millisecond'
                                   THEN NOW() ELSE r.rlt_window_start END
     RETURNING rlt_hits AS "totalHits", rlt_window_start + $2::INT * INTERVAL '1 millisecond' AS "resetTime"`,
    [key, windowMs],
  );
  return rows[0];
}

export async function unhitRateLimit(key: string): Promise<void> {
  await pool.query(`UPDATE "RATE_LIMIT_T" SET rlt_hits = GREATEST(rlt_hits - 1, 0) WHERE rlt_key = $1`, [key]);
}

export async function resetRateLimit(key: string): Promise<void> {
  await pool.query(`DELETE FROM "RATE_LIMIT_T" WHERE rlt_key = $1`, [key]);
}

/** Deletes counters whose window ended, each by its key prefix's own window; run by the daily purge job (D40, R37). Idempotent. */
export async function purgeRateLimits(windows: [prefix: string, windowMs: number][]): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM "RATE_LIMIT_T" r
     USING UNNEST($1::TEXT[], $2::INT[]) AS w(prefix, window_ms)
     WHERE STARTS_WITH(r.rlt_key, w.prefix)
       AND r.rlt_window_start < NOW() - w.window_ms * INTERVAL '1 millisecond'`,
    [windows.map(([prefix]) => prefix), windows.map(([, ms]) => ms)],
  );
  return rowCount ?? 0;
}
