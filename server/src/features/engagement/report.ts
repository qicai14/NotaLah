import { z } from 'zod';

/** The report form shared by notes and annotations (UC12, R10). */
const EVERYONE_REASONS = ['inaccurate', 'inappropriate', 'spam', 'other'];
export const LECTURER_REASONS = ['plagiarism', 'copyright'];
export const reportSchema = z.object({
  reason: z.enum([...EVERYONE_REASONS, ...LECTURER_REASONS], { error: 'Invalid reason' }),
  details: z.string({ error: 'Invalid details' }).trim().max(500, 'Details must be at most 500 characters').nullish(),
});
