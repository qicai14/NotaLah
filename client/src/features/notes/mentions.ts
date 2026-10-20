export interface Person {
  id: number;
  displayName: string;
}

/** The "@partial" being typed just before `caret` (an @ at the start or after whitespace), or null. */
export function findMention(text: string, caret: number): { start: number; query: string } | null {
  const m = /(^|\s)@([^@\n]{0,40})$/.exec(text.slice(0, caret));
  return m ? { start: caret - m[2].length - 1, query: m[2] } : null;
}

/** People whose name contains the query, name-start matches first, one row per id, at most `max`. */
export function suggest(people: Person[], query: string, max = 6): Person[] {
  const q = query.trim().toLowerCase();
  const seen = new Set<number>();
  return people
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), p.displayName.toLowerCase().includes(q))))
    .sort(
      (a, b) => Number(!a.displayName.toLowerCase().startsWith(q)) - Number(!b.displayName.toLowerCase().startsWith(q)),
    )
    .slice(0, max);
}

/** Replaces the "@partial" starting at `start` (ending at `caret`) with "@Name " and returns the new text and caret. */
export function insertMention(text: string, start: number, caret: number, name: string) {
  const insert = `@${name} `;
  return { text: text.slice(0, start) + insert + text.slice(caret), caret: start + insert.length };
}

/** Ids of picked people whose "@Name" is still in the text, which is what the server checks too (limit 10). */
export function mentionIds(text: string, picked: Map<number, string>, max = 10): number[] {
  return [...picked]
    .filter(([, name]) => text.includes(`@${name}`))
    .map(([id]) => id)
    .slice(0, max);
}
