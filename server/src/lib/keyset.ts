import type { Request, Response } from 'express';
import { z } from 'zod';

/** A parsed keyset cursor: its underscore-separated integer parts as strings (the last is a row id), or null for page 1. */
export type Cursor = string[] | null;

export interface KeysetPage {
  cursor: Cursor;
  limit: number;
}

const MAX_LIMIT = 100;

/** SQL: a TIMESTAMPTZ expression as whole microseconds since the epoch; a JS Date keeps milliseconds only and would skip rows (D38). */
export const micros = (col: string) => `(EXTRACT(EPOCH FROM ${col}) * 1000000)::BIGINT`;

/** SQL: the TIMESTAMPTZ that a `micros` cursor part (a placeholder) stands for. */
export const fromMicros = (param: string) => `(TIMESTAMPTZ 'epoch' + ${param}::BIGINT * INTERVAL '1 microsecond')`;

/**
 * Reads `?cursor=&limit=` (D40): a cursor of `parts` integers joined by `_`, the last an id; limit 1-100, default
 * `defaultLimit`. Sends 400 and returns undefined when either is malformed.
 */
export function parseKeyset(req: Request, res: Response, parts: number, defaultLimit = 50): KeysetPage | undefined {
  const schema = z.object({
    cursor: z
      .string({ error: 'Invalid cursor' })
      .regex(new RegExp(`^\\d{1,17}(?:_\\d{1,17}){${parts - 1}}$`), 'Invalid cursor')
      .refine((c) => Number(c.slice(c.lastIndexOf('_') + 1)) <= 2147483647, 'Invalid cursor')
      .optional(),
    limit: z.coerce.number({ error: 'Invalid limit' }).int('Invalid limit').min(1, 'Invalid limit').max(MAX_LIMIT, 'Invalid limit')
      .default(defaultLimit),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.issues[0].message });
  return { cursor: parsed.data.cursor?.split('_') ?? null, limit: parsed.data.limit };
}

/** The first `limit` rows of a query run with LIMIT limit + 1, without their `cursor` column, and the cursor of the last one when more follow. */
export function toPage<T extends { cursor: string | null }>(rows: T[], limit: number): { items: Omit<T, 'cursor'>[]; nextCursor: string | null } {
  const page = rows.slice(0, limit);
  return {
    items: page.map(({ cursor: _cursor, ...item }) => item),
    nextCursor: rows.length > limit ? page[page.length - 1].cursor : null,
  };
}
