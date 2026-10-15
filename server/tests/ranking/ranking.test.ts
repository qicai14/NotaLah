import { describe, expect, it } from 'vitest';
import { RANKING, assertWeightsSumToOne } from '../../src/features/ranking/config';
import { engagement, recency, relevance, score, validation } from '../../src/features/ranking/service';

describe('ranking components', () => {
  it('RANK-TC1: engagement with no likes or comments is 0', () => {
    expect(engagement(0, 0)).toBe(0);
  });

  it('RANK-TC2: engagement weights comments twice (raw 20 -> 0.660)', () => {
    expect(engagement(10, 5)).toBeCloseTo(Math.log10(21) / Math.log10(101), 9);
    expect(engagement(10, 5)).toBeCloseTo(0.66, 3);
  });

  it('RANK-TC3: engagement is capped at 1', () => {
    expect(engagement(150, 30)).toBe(1);
  });

  it('RANK-TC4: recency is 1, 0.5 and 0.25 at 0, 72 and 144 hours', () => {
    expect(recency(0)).toBe(1);
    expect(recency(72)).toBeCloseTo(0.5, 9);
    expect(recency(144)).toBeCloseTo(0.25, 9);
  });

  it('RANK-TC5: validation is 0.0, 0.5 and 1.0', () => {
    expect(validation({ verified: false, lecturerAuthor: false })).toBe(0);
    expect(validation({ verified: false, lecturerAuthor: true })).toBe(0.5);
    expect(validation({ verified: true, lecturerAuthor: false })).toBe(1);
  });

  it('RANK-TC6: relevance is 0 with no interests and diluted by hashtag padding', () => {
    expect(relevance(['sql'], new Map())).toBe(0);
    const interest = new Map([['sql', 1]]);
    expect(relevance(['sql'], interest)).toBe(1);
    expect(relevance(['sql', 'a', 'b', 'c'], interest)).toBe(0.25);
  });

  it('RANK-TC7: composite score reproduces the IR worked example (Table 10)', () => {
    const posts = [
      { E: 0.788, R: 0.707, V: 1.0, M: 0.976, S: 0.86 },
      { E: 0.349, R: 0.944, V: 0.5, M: 0.661, S: 0.59 },
      { E: 0.52, R: 0.972, V: 0.0, M: 0.968, S: 0.544 },
      { E: 1.0, R: 0.099, V: 0.0, M: 0.071, S: 0.336 },
      { E: 0.0, R: 0.99, V: 0.0, M: 0.0, S: 0.248 },
    ];
    const irWeights = { engagement: 0.3, recency: 0.25, lecturerValidation: 0.3, relevance: 0.15 }; // IR 2.3.4.7
    const scores = posts.map(({ S: _, ...c }) => score(c, irWeights));
    posts.forEach((p, i) => expect(Math.abs(scores[i] - p.S)).toBeLessThanOrEqual(0.002));
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});

describe('ranking config', () => {
  it('RANK-TC8: accepts the configured weights (sum = 1)', () => {
    expect(() => assertWeightsSumToOne()).not.toThrow();
  });

  it('RANK-TC8: throws when the weights do not sum to 1', () => {
    expect(() => assertWeightsSumToOne({ ...RANKING.weights, relevance: 0.2 })).toThrow(/sum to 1/);
  });

  it('RANK-TC8: the search blend weights sum to 1 too', () => {
    expect(() => assertWeightsSumToOne(RANKING.searchWeights)).not.toThrow();
  });

  it('RANK-TC8: the config object is frozen', () => {
    expect(Object.isFrozen(RANKING)).toBe(true);
    expect(Object.isFrozen(RANKING.weights)).toBe(true);
  });

  it('RANK-TC8: changed weights change the score without code change', () => {
    const c = { E: 0.5, R: 0.5, V: 1, M: 0.5 };
    const w = RANKING.weights;
    const tuned = { ...w, lecturerValidation: 0.4, engagement: 0.2, recency: 0.25, relevance: 0.15 };
    expect(() => assertWeightsSumToOne(tuned)).not.toThrow();
    expect(score(c)).toBeCloseTo(w.engagement * 0.5 + w.recency * 0.5 + w.lecturerValidation + w.relevance * 0.5, 9);
    expect(score(c, tuned)).toBeCloseTo(0.2 * 0.5 + 0.25 * 0.5 + 0.4 + 0.15 * 0.5, 9);
  });
});
