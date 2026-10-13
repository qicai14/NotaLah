import request from 'supertest';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

it('GET /api/health reports the database is up', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok', db: 'up' });
});
