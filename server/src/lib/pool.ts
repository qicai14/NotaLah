import { Pool, type PoolClient } from 'pg';
import { env } from './env';

const connectionString = process.env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL;
if (!connectionString) throw new Error('TEST_DATABASE_URL is required when NODE_ENV=test');

export const pool = new Pool({
  connectionString,
  max: env.PG_POOL_MAX,
  idleTimeoutMillis: env.PG_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.PG_CONNECTION_TIMEOUT_MS,
});
pool.on('error', (err) => console.error('pg pool error', err));

export async function inTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { broken = true; });
    throw err;
  } finally {
    client.release(broken);
  }
}

export const isUniqueViolation = (err: unknown): boolean => err instanceof Error && 'code' in err && err.code === '23505';
