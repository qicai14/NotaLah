import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../lib/env';

const AUDIENCE = 'ai-output';
const TTL = '24h';

const aiTokenKey = () => createHmac('sha256', env.JWT_SECRET).update(AUDIENCE).digest();

/** Returned with every AI reply; a save that carries it marks the note AI-assisted (R28, ADR 0094). */
export const signAiToken = (userId: number): string =>
  jwt.sign({}, aiTokenKey(), { algorithm: 'HS256', audience: AUDIENCE, subject: String(userId), expiresIn: TTL });

/** True only for an unexpired AI token issued to `userId`; anything else (missing, forged, another user's) is false. */
export function isAiTokenFor(token: unknown, userId: number): boolean {
  if (typeof token !== 'string' || !token) return false;
  try {
    jwt.verify(token, aiTokenKey(), { algorithms: ['HS256'], audience: AUDIENCE, subject: String(userId) });
    return true;
  } catch {
    return false;
  }
}
