// All feed-ranking constants live here (IR 2.3.4, NFR5). Never inline them elsewhere.
export const RANKING = Object.freeze({
  weights: Object.freeze({
    engagement: 0.3, // w1
    recency: 0.25, // w2
    lecturerValidation: 0.3, // w3
    relevance: 0.15, // w4
  }),
  /** Raw engagement = likes + commentEngagementWeight × comments (IR 2.3.4.2). */
  commentEngagementWeight: 2,
  engagementCap: 100,
  recencyHalfLifeHours: 72,
  interestHalfLifeDays: 14,
  /** Interest added per interaction before decay: views least, comments most (IR 2.3.4.5, D24). */
  interactionWeights: Object.freeze({ view: 1, like: 3, comment: 5 }),
  /** Interactions older than this add nothing to the interest vector (0.5^(90/14) is below 1.2 %). */
  interestWindowDays: 90,
  /** The purge keeps this many extra days, because later feed pages read the window ending at an asOf that lags NOW(). */
  purgeGraceDays: 1,
  /** Most recent published notes scored per feed request; older notes are scored only if verified (D24). */
  candidateLimit: 500,
  /** Only Super Likes made within this many days before asOf surface an old note as a candidate (D30). */
  verifiedCandidateWindowDays: 180,
});

export function assertWeightsSumToOne(weights: Record<string, number> = RANKING.weights): void {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`Ranking weights must sum to 1, got ${sum}`);
  }
}
