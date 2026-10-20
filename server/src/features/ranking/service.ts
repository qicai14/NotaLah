import { RANKING } from './config';

// Heuristic feed ranking (IR 2.3.4): S = w1·E + w2·R + w3·V + w4·M, every constant from config.ts (NFR5).

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export interface Components {
  E: number;
  R: number;
  V: number;
  M: number;
}

type InteractionType = keyof typeof RANKING.interactionWeights;

export interface InteractionRow {
  type: InteractionType;
  createdAt: Date;
  hashtag: string;
}

/** Hashtag name -> interest weight in [0, 1]. */
type InterestVector = Map<string, number>;

/** Log-compressed peer approval: raw = likes + commentEngagementWeight × comments, saturating at engagementCap. */
export function engagement(likes: number, comments: number): number {
  const raw = likes + RANKING.commentEngagementWeight * comments;
  return Math.min(1, Math.log10(1 + raw) / Math.log10(1 + RANKING.engagementCap));
}

/** Exponential decay with a half-life of recencyHalfLifeHours. */
export function recency(ageHours: number): number {
  return 0.5 ** (ageHours / RANKING.recencyHalfLifeHours);
}

/** 1.0 when Super Liked by an approved, active lecturer; 0.5 when an approved lecturer wrote it; else 0. */
export function validation(post: { verified: boolean; lecturerAuthor: boolean }): number {
  if (post.verified) return 1;
  return post.lecturerAuthor ? 0.5 : 0;
}

/** Mean viewer interest over all the post's hashtags, so padding with unrelated tags lowers M. */
export function relevance(hashtags: string[], interest: InterestVector): number {
  if (hashtags.length === 0) return 0;
  return hashtags.reduce((sum, tag) => sum + (interest.get(tag) ?? 0), 0) / hashtags.length;
}

/******************************************************************
 * Student Programmer: Mr Lim Qi Cai
 * Position: Student Programmer
 * Program Name: service.ts
 * Description: Combines the four normalised ranking components into the
 *   composite feed score S = w1·E + w2·R + w3·V + w4·M using the
 *   weights held in the ranking configuration module.
 * Date Created: 13/10/2026 | Date Modified: 13/10/2026
 ******************************************************************/
export function score(
  components: Components,
  weights: Record<keyof typeof RANKING.weights, number> = RANKING.weights,
): number {
  return (
    weights.engagement * components.E +
    weights.recency * components.R +
    weights.lecturerValidation * components.V +
    weights.relevance * components.M
  );
}

/******************************************************************
 * Student Programmer: Mr Lim Qi Cai
 * Position: Student Programmer
 * Program Name: service.ts
 * Description: Builds the viewer's hashtag interest vector from past views,
 *   likes and comments, decaying each by its age relative to asOf and
 *   normalising so that the strongest interest equals 1.0.
 * Date Created: 13/10/2026 | Date Modified: 13/10/2026
 ******************************************************************/
export function buildInterestVector(rows: InteractionRow[], asOf: Date): InterestVector {
  const totals: InterestVector = new Map();
  for (const row of rows) {
    const ageDays = (asOf.getTime() - row.createdAt.getTime()) / DAY_MS;
    if (ageDays < 0 || ageDays > RANKING.interestWindowDays) continue;
    const weight = RANKING.interactionWeights[row.type] * 0.5 ** (ageDays / RANKING.interestHalfLifeDays);
    totals.set(row.hashtag, (totals.get(row.hashtag) ?? 0) + weight);
  }
  const max = Math.max(0, ...totals.values());
  for (const [tag, weight] of totals) totals.set(tag, weight / max);
  return totals;
}

export interface Candidate {
  publishedAt: Date;
  hashtags: string[];
  counts: { likes: number; comments: number };
  verified: boolean;
  lecturerAuthor: boolean;
}

/** The score and its components for one candidate; age is measured against the feed's asOf, not NOW() (D22). */
export function scoreCandidate(
  post: Candidate,
  interest: InterestVector,
  asOf: Date,
): { score: number; components: Components } {
  const components = {
    E: engagement(post.counts.likes, post.counts.comments),
    R: recency((asOf.getTime() - post.publishedAt.getTime()) / HOUR_MS),
    V: validation(post),
    M: relevance(post.hashtags, interest),
  };
  return { score: score(components), components };
}
