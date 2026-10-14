import bcrypt from 'bcryptjs';
import type { CookieOptions, Request } from 'express';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as JwtStrategy } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import { env } from '../../lib/env';
import { type AuthUser, findUserByEmail, findUserById, toAuthUser } from '../users/repository';

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
}

export const BCRYPT_COST = 12;
export const TOKEN_TTL_SECONDS = 3600;
export const AUTH_COOKIE = 'parp_token';
const COOKIE_PATTERN = new RegExp(String.raw`(?:^|;\s*)${AUTH_COOKIE}=([^;]+)`);
const BLOCKED_STATUSES = new Set(['suspended', 'deleted']);

// bcrypt hash (cost 12) of a random throwaway value. Precomputed so importing this module does not block
// the event loop; compared against when the email is unknown, so timing does not reveal which accounts exist.
const DUMMY_HASH = '$2b$12$RlrI9iOSRzy3g1iXWWluwuttoBLEuxgVYd7SRuC8cOnhMVrJEseEW';

export function signToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

/** Attributes shared by setting and clearing the auth cookie (D35); read per call so tests can flip COOKIE_SECURE. */
export function authCookieOptions(): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', path: '/', secure: env.COOKIE_SECURE };
}

// The token is read from the httpOnly cookie only, never a bearer header, so page script can never hold it (D35).
const fromAuthCookie = (req: Request): string | null => req.headers.cookie?.match(COOKIE_PATTERN)?.[1] ?? null;

/** Verification rules shared by the JWT strategy and tokenSubject, so the rate-limit key never trusts a token the strategy would reject. */
const JWT_VERIFY = { algorithms: ['HS256'] as jwt.Algorithm[] };

/** The user id in a valid auth cookie, or null; keys the write rate limit before requireAuth runs (D40). */
export function tokenSubject(req: Request): string | null {
  const token = fromAuthCookie(req);
  if (!token) return null;
  try {
    return (jwt.verify(token, env.JWT_SECRET, JWT_VERIFY) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}

/** `info.status` tells the login route which HTTP status to send when `user` is false. */
export interface LoginInfo {
  status: 401 | 403;
  message: string;
}

passport.use(
  new LocalStrategy({ usernameField: 'email', session: false }, async (email, password, done) => {
    try {
      const row = await findUserByEmail(email.trim().toLowerCase());
      const ok = await bcrypt.compare(password, row?.usr_password_hash ?? DUMMY_HASH);
      const fail = (info: LoginInfo) => done(null, false, info);
      if (!row || !ok) return fail({ status: 401, message: 'Invalid email or password' });
      // A deleted account looks like an unknown one; only suspended reveals itself.
      if (row.usr_status === 'deleted') return fail({ status: 401, message: 'Invalid email or password' });
      if (row.usr_status === 'suspended') return fail({ status: 403, message: 'This account is suspended' });
      return done(null, toAuthUser(row));
    } catch (err) {
      return done(err);
    }
  }),
);

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: fromAuthCookie,
      secretOrKey: env.JWT_SECRET,
      ...JWT_VERIFY,
    },
    // The user is reloaded on every request so role changes and suspensions apply immediately (D13).
    async (payload: { sub?: string }, done: (err: unknown, user?: AuthUser | false) => void) => {
      try {
        const id = Number(payload.sub);
        if (!Number.isSafeInteger(id)) return done(null, false);
        const row = await findUserById(id);
        if (!row || BLOCKED_STATUSES.has(row.usr_status)) return done(null, false);
        return done(null, toAuthUser(row));
      } catch (err) {
        return done(err);
      }
    },
  ),
);

export { passport };
