import { LIMITS } from '@notalah/shared';

const VALID = /^[a-z0-9_]{1,50}$/;

/** Adds comma-separated tags to `current`: '#' stripped, lowercased, duplicates ignored, invalid or surplus tags rejected with a message. */
export function addHashtags(current: string[], raw: string): { tags: string[]; error: string | null } {
  let tags = current;
  let error: string | null = null;
  for (const part of raw.split(',')) {
    const name = part.trim().replace(/^#+/, '').toLowerCase();
    if (!name || tags.includes(name)) continue;
    if (!VALID.test(name)) error = `"${name.slice(0, 20)}" is not valid: use letters, numbers and underscores (max 50)`;
    else if (tags.length >= LIMITS.hashtags) error = `Maximum ${LIMITS.hashtags} hashtags`;
    else tags = [...tags, name];
  }
  return { tags, error };
}
