import { describe, expect, it } from 'vite-plus/test';
import { findMention, insertMention, mentionIds, suggest } from './mentions';

const people = [
  { id: 1, displayName: 'Aina Rahman' },
  { id: 2, displayName: 'Dr Lee' },
  { id: 1, displayName: 'Aina Rahman' },
  { id: 3, displayName: 'Maina' },
];

describe('R8 UI mentions', () => {
  it('NTF-TC23 finds the partial name at the caret and inserts the pick', () => {
    expect(findMention('hi @Ai', 6)).toEqual({ start: 3, query: 'Ai' });
    expect(findMention('mail a@b', 8)).toBeNull();
    expect(findMention('hi @Ai there', 6)?.query).toBe('Ai');
    const r = insertMention('hi @Ai there', 3, 6, 'Aina Rahman');
    expect(r.text).toBe('hi @Aina Rahman  there');
    expect(r.caret).toBe(3 + '@Aina Rahman '.length);
    // right after a pick the list is closed: "@Aina Rahman " matches nobody
    const again = findMention(r.text, r.caret)!;
    expect(suggest(people, again.query)).toEqual([]);
  });

  it('NTF-TC24 suggests once per person, prefix matches first, and sends only still-named ids', () => {
    expect(suggest(people, 'ain').map((p) => p.id)).toEqual([1, 3]);
    expect(suggest(people, 'aina').map((p) => p.id)).toEqual([1, 3]);
    const picked = new Map([
      [1, 'Aina Rahman'],
      [2, 'Dr Lee'],
    ]);
    expect(mentionIds('thanks @Aina Rahman!', picked)).toEqual([1]);
  });
});
