import { describe, expect, it } from 'vite-plus/test';
import { assertLoadDatabase } from '../../src/scripts/load/guard';
import { nfr1Verdict, percentile, summarise } from '../../src/scripts/load/stats';

const hundred = Array.from({ length: 100 }, (_, i) => 100 - i);

describe('load tooling', () => {
  it('OPS-TC11: percentile is nearest-rank on unsorted values and NaN when empty', () => {
    expect(percentile(hundred, 50)).toBe(50);
    expect(percentile(hundred, 95)).toBe(95);
    expect(percentile(hundred, 99)).toBe(99);
    expect(percentile(hundred, 100)).toBe(100);
    expect(percentile([7], 99)).toBe(7);
    expect(percentile([], 50)).toBeNaN();
    expect(hundred[0]).toBe(100);
  });

  it('OPS-TC12: summary counts errors and NFR1 passes only on search p95 under 3000 ms with no errors', () => {
    const fast = hundred.map((ms) => ({ ms: ms * 10, ok: true }));
    const s = summarise(fast);
    expect(s).toMatchObject({ count: 100, errors: 0, p50: 500, p95: 950, p99: 990, max: 1000 });
    expect(nfr1Verdict(s)).toEqual({ pass: true, allUnderLimit: true });

    const slowTail = summarise([...fast, { ms: 4000, ok: true }]);
    expect(nfr1Verdict(slowTail)).toEqual({ pass: true, allUnderLimit: false });

    const slow = summarise(hundred.map((ms) => ({ ms: ms * 40, ok: true })));
    expect(nfr1Verdict(slow).pass).toBe(false);

    const failed = summarise([...fast, { ms: 10, ok: false }]);
    expect(failed.errors).toBe(1);
    expect(nfr1Verdict(failed).pass).toBe(false);
    expect(nfr1Verdict(summarise([])).pass).toBe(false);
  });

  it('OPS-TC13: the load seed refuses any database not named notalah_test_*', () => {
    for (const name of ['notalah', 'notalah_prod', 'postgres', 'notalah_tes', 'x_notalah_test_1'])
      expect(() => assertLoadDatabase(name)).toThrow(/refused/);
    expect(() => assertLoadDatabase('notalah_test_r27_load')).not.toThrow();
    expect(() => assertLoadDatabase('notalah_test_')).not.toThrow();
  });
});
