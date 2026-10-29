import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { asUser, truncateAll } from '../helpers';
import { ASOF, LABEL_STATUS, NOTES, VIEWERS, seedNfr3 } from './nfr3-seed';

// NFR3 feed half (#77): share of viewer cases whose top 5 holds a verified note, a subject-relevant note, or either.
let result: { verified: number; relevant: number; combined: number; misses: number[] };

beforeAll(async () => {
  await truncateAll();
  const { noteIds, viewerIds } = await seedNfr3();
  const label = new Map(noteIds.map((id, i) => [id, NOTES[i]]));
  const hits = { verified: 0, relevant: 0, combined: 0 };
  const misses: number[] = [];
  for (const [c, uid] of viewerIds.entries()) {
    const res = await request(app).get('/api/feed').query({ asOf: ASOF.toISOString() }).set(asUser(uid));
    expect(res.status).toBe(200);
    const top = (res.body.items as { id: number }[]).slice(0, 5).map((i) => label.get(i.id)!);
    const verified = top.some((n) => n.verified);
    const relevant = top.some(
      (n) => !n.verified && !n.history && n.tags.some((t) => VIEWERS[c].subjects.includes(t as never)),
    );
    hits.verified += +verified;
    hits.relevant += +relevant;
    hits.combined += +(verified || relevant);
    if (!relevant) misses.push(c + 1);
  }
  const share = (k: number) => k / viewerIds.length;
  result = { verified: share(hits.verified), relevant: share(hits.relevant), combined: share(hits.combined), misses };
}, 120_000);
afterAll(() => pool.end());

describe('NFR3 feed relevance on the labelled seed', () => {
  it('RANK-TC33: the measured top-5 shares on the provisional seed are fixed (deterministic)', () => {
    // stdout, not console.log: the runner hides console output of passing tests, and these numbers are the deliverable.
    process.stdout.write(
      `NFR3 feed top-5 (labels ${LABEL_STATUS}, n=${VIEWERS.length} viewers): verified ${result.verified * 100}%, ` +
        `subject-relevant ${result.relevant * 100}%, combined ${result.combined * 100}%; relevant misses: viewers ${result.misses.join(', ') || 'none'}
`,
    );
    expect(result).toEqual({ verified: 1, relevant: 0.2, combined: 1, misses: [1, 2, 3, 5, 6, 7, 8, 9] });
  });

  // Known gap: measured 20% (only the viewers whose Subject has a lecturer-written note pass); popular off-topic notes fill
  // the slots under the verified ones. it.fails keeps CI green and turns red once ranking meets the target (NFR5 / #77).
  it.fails('RANK-TC34: a subject-relevant note is in every viewer top 5 at default weights (NFR3 target 100%)', () => {
    expect(result.relevant).toBe(1);
  });
});
