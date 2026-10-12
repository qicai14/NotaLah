// All feed-ranking constants live here (IR 2.3.4, NFR5). Never inline them elsewhere.
export const RANKING = Object.freeze({
  weights: Object.freeze({
    engagement: 0.3, // w1
    recency: 0.25, // w2
    lecturerValidation: 0.3, // w3
    relevance: 0.15, // w4
  }),
  engagementCap: 100,
  recencyHalfLifeHours: 72,
  interestHalfLifeDays: 14,
});

export function assertWeightsSumToOne(weights: Record<string, number> = RANKING.weights): void {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`Ranking weights must sum to 1, got ${sum}`);
  }
}
