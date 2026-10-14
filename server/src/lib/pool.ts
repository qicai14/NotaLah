import { Pool, type PoolClient } from 'pg';
import { env } from './env';

const connectionString = process.env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL;
if (!connectionString) throw new Error('TEST_DATABASE_URL is required when NODE_ENV=test');

export const pool = new Pool({ connectionString });
pool.on('error', (err) => console.error('pg pool error', err));

/** Runs fn inside BEGIN/COMMIT on one connection; rolls back and rethrows on error. */
export async function inTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let failed = false;
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    failed = true;
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release(failed || undefined);
  }
}
