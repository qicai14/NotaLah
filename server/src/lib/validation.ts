import type { Request, RequestParamHandler } from 'express';
import type { z } from 'zod';

/** "Slide 3, element 2: " for an issue inside `slides`, so a deck error says where it is; empty elsewhere. */
function slidePrefix(path: PropertyKey[]): string {
  if (path[0] !== 'slides' || typeof path[1] !== 'number') return '';
  const element = path[2] === 'elements' && typeof path[3] === 'number' ? `, element ${path[3] + 1}` : '';
  return `Slide ${path[1] + 1}${element}: `;
}

/** Collapses zod issues into the API's `{ field: message }` map (first message per field wins). */
export function issueMap(issues: z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0] ?? 'form')] ??= slidePrefix(issue.path) + issue.message;
  return errors;
}

/** Not digits only, or outside 1 to the INTEGER maximum. */
export const invalidId = (s: string | string[]) => !/^\d+$/.test(String(s)) || Number(s) < 1 || Number(s) > 2147483647;

/** `router.param` handler: a malformed id answers `status` with `message` once instead of in every handler. */
export const idParam =
  (message: string, status = 404): RequestParamHandler =>
  (_req, res, next, value) =>
    invalidId(value) ? void res.status(status).json({ error: message }) : next();

/** The JSON body when it is an object, else `{}`, so handlers can destructure or hand it to zod without a null check. */
export const bodyOrEmpty = (req: Request): Record<string, unknown> =>
  req.body && typeof req.body === 'object' ? req.body : {};
