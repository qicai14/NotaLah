import type { z } from 'zod';

/** Collapses zod issues into the API's `{ field: message }` map (first message per field wins). */
export function issueMap(issues: z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0] ?? 'form')] ??= issue.message;
  return errors;
}

export const invalidId = (s: string | string[]) => !/^\d+$/.test(String(s)) || Number(s) < 1 || Number(s) > 2147483647;
