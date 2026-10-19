// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { ApiError } from './api';
import { useAction } from './useAction';

afterEach(cleanup);

describe('useAction', () => {
  it('CLI-TC20: ignores a second call while one is pending, shows the ApiError message, and lets onError handle it', async () => {
    const { result } = renderHook(() => useAction());

    let release!: (v: string) => void;
    const slow = vi.fn(() => new Promise<string>((r) => (release = r)));
    const second = vi.fn(async () => 'second');
    let first!: Promise<string | undefined>;
    let again!: Promise<string | undefined>;
    act(() => {
      first = result.current.run(slow);
      again = result.current.run(second);
    });
    expect(result.current.pending).toBe(true);
    expect(await again).toBeUndefined();
    expect(second).not.toHaveBeenCalled();
    await act(async () => release('done'));
    expect(await first).toBe('done');
    expect(result.current.pending).toBe(false);

    await act(async () => {
      expect(await result.current.run(() => Promise.reject(new ApiError(409, 'Already liked')))).toBeUndefined();
    });
    expect(result.current.error).toBe('Already liked');

    const handled = vi.fn(() => null);
    await act(async () => {
      await result.current.run(() => Promise.reject(new ApiError(400, 'Validation failed')), handled);
    });
    expect(handled).toHaveBeenCalledOnce();
    expect(result.current.error).toBeNull();
  });
});
