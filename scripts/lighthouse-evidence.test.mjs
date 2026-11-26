import { describe, expect, it } from 'vite-plus/test';
import { summarise } from './lighthouse-evidence.mjs';

const lhr = (score, audits) => ({
  finalDisplayedUrl: 'http://localhost:5173/notes/new?x=1',
  categories: { accessibility: { score, auditRefs: Object.keys(audits).map((id) => ({ id })) } },
  audits: Object.fromEntries(Object.entries(audits).map(([id, s]) => [id, { id, score: s }])),
});

describe('summarise', () => {
  it('rounds the score, keeps the final path and lists failed accessibility audits only', () => {
    const r = summarise({ ...lhr(0.964, { 'color-contrast': 0, 'aria-roles': 1, 'html-lang': null }) });
    expect(r).toEqual({ finalUrl: '/notes/new', accessibility: 96, failed: ['color-contrast'] });
  });
});
