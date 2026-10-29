import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { asUser, truncateAll } from '../helpers';
import { ASOF, LABEL_STATUS, NOTES, VIEWERS, isRelevant, isRelevantOnM, seedNfr3 } from './nfr3-seed';

let result: { verified: number; relevant: number; relevantOnM: number; missesOnM: number[] };

beforeAll(async () => {
  await truncateAll();
  const { noteIds, viewerIds } = await seedNfr3();
  const label = new Map(noteIds.map((id, i) => [id, NOTES[i]]));
  const hits = { verified: 0, relevant: 0, relevantOnM: 0 };
  const missesOnM: number[] = [];
  for (const [c, uid] of viewerIds.entries()) {
    const res = await request(app).get('/api/feed').query({ asOf: ASOF.toISOString() }).set(asUser(uid));
    expect(res.status).toBe(200);
    const top = (res.body.items as { id: number }[]).slice(0, 5).map((i) => label.get(i.id)!);
    const onM = top.some((n) => isRelevantOnM(n, VIEWERS[c]));
    hits.verified += +top.some((n) => n.verified);
    hits.relevant += +top.some((n) => isRelevant(n, VIEWERS[c]));
    hits.relevantOnM += +onM;
    if (!onM) missesOnM.push(c + 1);
  }
  const share = (k: number) => k / viewerIds.length;
  result = {
    verified: share(hits.verified),
    relevant: share(hits.relevant),
    relevantOnM: share(hits.relevantOnM),
    missesOnM,
  };
}, 120_000);
afterAll(() => pool.end());

describe('NFR3 feed relevance on the labelled seed', () => {
  it('RANK-TC33: the measured top-5 shares on the provisional seed are fixed (regression pin)', () => {
    // stdout, not console.log: the runner hides console output of passing tests, and these numbers are the deliverable.
    process.stdout.write(
      `NFR3 feed top-5 (labels ${LABEL_STATUS}, n=${VIEWERS.length} viewers): verified ${result.verified * 100}% ` +
        `(verified notes are global, so verified-or-relevant is trivially 100%), subject-relevant any V ${result.relevant * 100}%, ` +
        `subject-relevant on M alone (V = 0) ${result.relevantOnM * 100}%; M-alone misses: viewers ${result.missesOnM.join(', ') || 'none'}\n`,
    );
    expect(result).toEqual({ verified: 1, relevant: 1, relevantOnM: 1, missesOnM: [] });
  });

  it('RANK-TC34: a subject-relevant note on M alone is in every viewer top 5 at default weights (NFR3 target 100%)', () => {
    expect(result.relevantOnM).toBe(1);
  });
});
