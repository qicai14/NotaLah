import request from 'supertest';
import { afterAll, beforeEach, expect, it, vi } from 'vite-plus/test';
import { app } from '../../src/app';
import pino from 'pino';
import { env } from '../../src/lib/env';
import { loggerOptions, logPath } from '../../src/lib/logger';
import { pool } from '../../src/lib/pool';
import { truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

it('OPS-TC1: GET /api/health/db reports the database is up', async () => {
  const res = await request(app).get('/api/health/db');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok', db: 'up' });
});

it('OPS-TC8: GET /api/health reports the deployed commit when Render sets one, and omits it locally', async () => {
  expect((await request(app).get('/api/health')).body).not.toHaveProperty('version');
  env.RENDER_GIT_COMMIT = 'abc123';
  try {
    expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok', version: 'abc123' });
    expect((await request(app).get('/api/health/db')).body).toEqual({ status: 'ok', db: 'up', version: 'abc123' });
  } finally {
    env.RENDER_GIT_COMMIT = undefined;
  }
});

it('OPS-TC2: GET /api/health/db answers 503 when the database is unreachable', async () => {
  const spy = vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('connection refused') as never);
  const res = await request(app).get('/api/health/db');
  spy.mockRestore();
  expect(res.status).toBe(503);
  expect(res.body).toEqual({ status: 'degraded', db: 'down' });
});

it('OPS-TC11: GET /api/health answers 200 without querying the database', async () => {
  const spy = vi.spyOn(pool, 'query').mockRejectedValue(new Error('connection refused') as never);
  try {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(spy).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});

it('OPS-TC3: every response carries an X-Request-Id, reusing a safe incoming one', async () => {
  const generated = await request(app).get('/api/health');
  expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  const kept = await request(app).get('/api/health').set('X-Request-Id', 'abc-123');
  expect(kept.headers['x-request-id']).toBe('abc-123');
  const unsafe = await request(app).get('/api/health').set('X-Request-Id', 'bad id<script>');
  expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
});

it('OPS-TC4: log redaction hides the set-cookie header and password fields', () => {
  const lines: string[] = [];
  const log = pino({ ...loggerOptions, level: 'info' }, { write: (l: string) => void lines.push(l) });
  log.info(
    { res: { headers: { 'set-cookie': ['notalah_token=secret123; HttpOnly'] } }, body: { password: 'hunter2' } },
    'x',
  );
  const out = lines.join('');
  expect(out).toContain('[redacted]');
  expect(out).not.toContain('notalah_token=');
  expect(out).not.toContain('hunter2');
});

it('OPS-TC5: logged paths hide share-link tokens and query strings', () => {
  expect(logPath('/api/share/AbC_-123?x=1')).toBe('/api/share/[token]');
  expect(logPath('/api/notes/5?cursor=abc')).toBe('/api/notes/5');
  expect(logPath(undefined)).toBeUndefined();
});
