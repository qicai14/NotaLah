import { describe, expect, it } from 'vitest';
import { RANKING, assertWeightsSumToOne } from '../src/config/ranking';

describe('ranking config', () => {
  it('RANK-TC8: accepts the configured weights (sum = 1)', () => {
    expect(() => assertWeightsSumToOne()).not.toThrow();
  });

  it('RANK-TC8: throws when the weights do not sum to 1', () => {
    expect(() => assertWeightsSumToOne({ ...RANKING.weights, relevance: 0.2 })).toThrow(/sum to 1/);
  });

  it('RANK-TC8: the config object is frozen', () => {
    expect(Object.isFrozen(RANKING)).toBe(true);
    expect(Object.isFrozen(RANKING.weights)).toBe(true);
  });
});
