import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { attachSocket } from '../../src/features/messaging/socket';
import { env } from '../../src/lib/env';
import { pool } from '../../src/lib/pool';
import { asUser, insertUser, truncateAll } from '../helpers';

const server = createServer(app);
const io = attachSocket(server);
let url = '';
const open: Socket[] = [];

beforeAll(() => new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => {
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  resolve();
})));
beforeEach(truncateAll);
afterEach(() => open.splice(0).forEach((s) => s.disconnect()));
afterAll(async () => {
  await new Promise((resolve) => io.close(resolve));
  await pool.end();
});

function socketAs(id: number): Promise<Socket> {
  const s = connect(url, { transports: ['websocket'], extraHeaders: { Cookie: asUser(id).Cookie, Origin: env.CLIENT_ORIGIN }, reconnection: false, forceNew: true });
  open.push(s);
  return new Promise((resolve, reject) => {
    s.once('connect', () => setTimeout(() => resolve(s), 50));
    s.once('connect_error', reject);
  });
}

const next = <T = Record<string, unknown>>(s: Socket, event: string, ms = 1000) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event} within ${ms} ms`)), ms);
    s.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

describe('Live notifications', () => {
  it('NTF-TC17: notification:new reaches the recipient with the unread count; marking read pushes notification:count', async () => {
    const a = await insertUser({ displayName: 'Ann' });
    const b = await insertUser();
    const bSocket = await socketAs(b);
    const aSocket = await socketAs(a);
    let aGot = false;
    aSocket.on('notification:new', () => { aGot = true; });

    const live = next<{ notification: { type: string; actor: { id: number } }; unreadCount: { total: number } }>(bSocket, 'notification:new');
    await request(app).post(`/api/users/${b}/follow`).set(asUser(a)).expect(201);
    const payload = await live;
    expect(payload.notification).toMatchObject({ type: 'follow', actor: { id: a, displayName: 'Ann' }, read: false });
    expect(payload.unreadCount).toEqual({ total: 1, byType: { follow: 1 } });

    const count = next(bSocket, 'notification:count');
    await request(app).post('/api/notifications/read').set(asUser(b)).expect(200);
    expect(await count).toEqual({ unreadCount: { total: 0, byType: {} } });
    expect(aGot).toBe(false);
  });
});
