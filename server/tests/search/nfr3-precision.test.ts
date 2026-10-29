import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { asUser, truncateAll } from '../helpers';
import { ASOF, LABEL_STATUS, NOTES, SUBJECTS, seedNfr3 } from '../ranking/nfr3-seed';

let perQuery: Record<string, number>;
let mean: number;

beforeAll(async () => {
  await truncateAll();
  const { noteIds, viewerIds } = await seedNfr3();
  const label = new Map(noteIds.map((id, i) => [id, NOTES[i]]));
  perQuery = {};
  for (const q of SUBJECTS) {
    const res = await request(app)
      .get('/api/search')
      .query({ q, tab: 'notes', asOf: ASOF.toISOString() })
      .set(asUser(viewerIds[0]));
    expect(res.status).toBe(200);
    const top = (res.body.items as { id: number }[]).slice(0, 5);
    perQuery[q] = top.filter((i) => label.get(i.id)!.topic === q).length / 5;
  }
  mean = Object.values(perQuery).reduce((a, b) => a + b, 0) / SUBJECTS.length;
}, 120_000);
afterAll(() => pool.end());

describe('NFR3 search precision on the labelled seed', () => {
  it('SRCH-TC18: precision@5 per query and overall on the provisional seed are fixed and meet 0.8', () => {
    // stdout, not console.log: the runner hides console output of passing tests, and these numbers are the deliverable.
    process.stdout.write(
      `NFR3 search P@5 (labels ${LABEL_STATUS}, n=${SUBJECTS.length} queries): mean ${mean.toFixed(3)}; ` +
        `${Object.entries(perQuery)
          .map(([q, p]) => `${q} ${p}`)
          .join(', ')}\n`,
    );
    expect(perQuery).toEqual({
      normalisation: 0.8,
      recursion: 0.6,
      subnetting: 1,
      deadlock: 0.8,
      encryption: 0.8,
      uml: 1,
    });
    expect(mean).toBeGreaterThanOrEqual(0.8);
  });
});
