import type { Request, RequestParamHandler } from 'express';
import type { z } from 'zod';

/** Collapses zod issues into the API's `{ field: message }` map (first message per field wins). */
export function issueMap(issues: z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0] ?? 'form')] ??= issue.message;
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
