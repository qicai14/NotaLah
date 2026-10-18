import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { parseEnv } from '../../src/lib/env';
import { r2StorageDriver } from '../../src/lib/storage';

const cfg = { accountId: 'acct', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret-value', bucket: 'bkt' };
const KEY = 'i/00000000-0000-0000-0000-000000000000.webp';
const driver = (res: () => Response) => {
  const fetchMock = vi.fn(async (_req: Request, _init?: RequestInit) => res());
  return { fetchMock, store: r2StorageDriver(cfg, fetchMock as unknown as typeof fetch) };
};
const sent = (f: ReturnType<typeof driver>['fetchMock']) => f.mock.calls[0]![0];
const text = async (s: Readable) => {
  let out = '';
  for await (const c of s) out += c;
  return out;
};

describe('R2 storage driver', () => {
  it('STO-TC1: put sends one signed PutObject to the account endpoint', async () => {
    const { fetchMock, store } = driver(() => new Response(null, { status: 200 }));
    await store.put(KEY, Buffer.from('hello'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const req = sent(fetchMock);
    expect(req.method).toBe('PUT');
    expect(req.url).toBe(`https://acct.r2.cloudflarestorage.com/bkt/${KEY}`);
    expect(req.headers.get('authorization')).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=.*, Signature=[0-9a-f]{64}$/,
    );
    expect(req.headers.get('x-amz-content-sha256')).toBe('UNSIGNED-PAYLOAD');
    expect(await req.text()).toBe('hello');
  });

  it('STO-TC2: a failed put throws without leaking credentials', async () => {
    const { store } = driver(() => new Response('denied', { status: 403 }));
    const err = await store.put(KEY, Buffer.from('x')).catch((e: Error) => e);
    expect((err as Error).message).toBe('R2 put failed with status 403');
  });

  it('STO-TC3: a ranged read sends Range and maps 206 to a partial result', async () => {
    const { fetchMock, store } = driver(
      () => new Response('ell', { status: 206, headers: { 'content-range': 'bytes 1-3/5' } }),
    );
    const r = await store.read(KEY, 'bytes=1-3');
    expect(sent(fetchMock).headers.get('range')).toBe('bytes=1-3');
    expect(r).toMatchObject({ size: 5, start: 1, end: 3, partial: true });
    expect(await text((r as { stream: Readable }).stream)).toBe('ell');
  });

  it('STO-TC4: a whole read maps 200 and ignores a multi-range header', async () => {
    const { fetchMock, store } = driver(
      () => new Response('hello', { status: 200, headers: { 'content-length': '5' } }),
    );
    const r = await store.read(KEY, 'bytes=0-1,3-4');
    expect(sent(fetchMock).headers.get('range')).toBeNull();
    expect(r).toMatchObject({ size: 5, start: 0, end: 4, partial: false });
  });

  it('STO-TC5: 404 reads as not found and 416 as unsatisfiable with the object size', async () => {
    const missing = driver(() => new Response('', { status: 404 }));
    expect(await missing.store.read(KEY)).toBeNull();
    const bad = driver(() => new Response('', { status: 416, headers: { 'content-range': 'bytes */5' } }));
    expect(await bad.store.read(KEY, 'bytes=9-')).toEqual({ unsatisfiable: 5 });
  });

  it('STO-TC6: a 5xx on read throws and is not retried', async () => {
    const { fetchMock, store } = driver(() => new Response('', { status: 503 }));
    await expect(store.read(KEY)).rejects.toThrow('R2 read failed with status 503');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('STO-TC7: remove sends DeleteObject and treats 404 as success', async () => {
    const ok = driver(() => new Response(null, { status: 204 }));
    await ok.store.remove(KEY);
    expect(sent(ok.fetchMock).method).toBe('DELETE');
    await driver(() => new Response(null, { status: 404 })).store.remove(KEY);
    await expect(driver(() => new Response(null, { status: 500 })).store.remove(KEY)).rejects.toThrow('status 500');
  });

  it('STO-TC13: malformed 206 or 200 headers fail cleanly before streaming; 416 without a size throws', async () => {
    const noRange = driver(() => new Response('x', { status: 206 }));
    await expect(noRange.store.read(KEY, 'bytes=0-0')).rejects.toThrow('R2 read failed with status 206');
    const noLen = driver(() => new Response('x', { status: 200, headers: { 'content-length': 'abc' } }));
    await expect(noLen.store.read(KEY)).rejects.toThrow('R2 read failed with status 200');
    const bad = driver(() => new Response('', { status: 416 }));
    await expect(bad.store.read(KEY, 'bytes=9-')).rejects.toThrow('416');
  });

  it('STO-TC8: a key the server did not generate never reaches R2', async () => {
    const { fetchMock, store } = driver(() => new Response(null, { status: 200 }));
    await expect(store.put('../x', Buffer.from('x'))).rejects.toThrow('Invalid storage key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('STO-TC9: a request that never answers is aborted by the timeout', async () => {
    vi.useFakeTimers();
    try {
      const hang = vi.fn(
        (_req: unknown, init?: RequestInit) =>
          new Promise<Response>((_, reject) => {
            if (init?.signal?.aborted) reject(new Error('aborted'));
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );
      const store = r2StorageDriver(cfg, hang as unknown as typeof fetch);
      const p = store.remove(KEY).catch((e: Error) => e);
      await vi.advanceTimersByTimeAsync(15_001);
      expect(((await p) as Error).message).toBe('aborted');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('storage driver selection', () => {
  const base = { DATABASE_URL: 'postgres://x', JWT_SECRET: 'x'.repeat(16) };

  it('STO-TC10: r2 without its variables fails at startup naming each missing one, not values', () => {
    let msg = '';
    try {
      parseEnv({ ...base, STORAGE_DRIVER: 'r2', R2_ACCOUNT_ID: 'acct', R2_SECRET_ACCESS_KEY: 'topsecret' });
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain('R2_ACCESS_KEY_ID is required when STORAGE_DRIVER=r2');
    expect(msg).toContain('R2_BUCKET is required when STORAGE_DRIVER=r2');
    expect(msg).not.toContain('R2_ACCOUNT_ID is required');
    expect(msg).not.toContain('topsecret');
  });

  it('STO-TC11: the driver defaults to local and r2 parses with all four variables', () => {
    expect(parseEnv(base).STORAGE_DRIVER).toBe('local');
    const r2 = {
      STORAGE_DRIVER: 'r2',
      R2_ACCOUNT_ID: 'a',
      R2_ACCESS_KEY_ID: 'b',
      R2_SECRET_ACCESS_KEY: 'c',
      R2_BUCKET: 'd',
    };
    expect(parseEnv({ ...base, ...r2 }).STORAGE_DRIVER).toBe('r2');
  });
});

describe.skipIf(process.env.R2_LIVE_TEST !== '1')('R2 live smoke', () => {
  it('STO-TC12: put, ranged read and delete a tiny object under the t/ prefix', async () => {
    const store = r2StorageDriver({
      accountId: process.env.R2_ACCOUNT_ID!,
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      bucket: process.env.R2_BUCKET!,
    });
    const key = 't/00000000-0000-0000-0000-0000000057e5.txt';
    await store.put(key, Buffer.from('hello'));
    try {
      expect(await store.read(key, 'bytes=99-')).toEqual({ unsatisfiable: 5 });
      const r = await store.read(key, 'bytes=1-3');
      expect(r).toMatchObject({ size: 5, start: 1, end: 3, partial: true });
      expect(await text((r as { stream: Readable }).stream)).toBe('ell');
    } finally {
      await store.remove(key);
    }
  });
});
