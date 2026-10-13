import { Pool } from 'pg';
import { env } from '../config/env';

const connectionString = process.env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL;
if (!connectionString) throw new Error('TEST_DATABASE_URL is required when NODE_ENV=test');

export const pool = new Pool({ connectionString });
pool.on('error', (err) => console.error('pg pool error', err));
