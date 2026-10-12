import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import { env } from '../config/env';
import { type AuthUser, findUserByEmail, findUserById, toAuthUser } from '../db/users';

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
}

export const BCRYPT_COST = 12;
const TOKEN_TTL = '1h';
const BLOCKED_STATUSES = new Set(['suspended', 'deleted']);

// Compared against when the email is unknown, so the response time does not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-password', BCRYPT_COST);

export function signToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: TOKEN_TTL,
  });
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
      if (BLOCKED_STATUSES.has(row.usr_status)) return fail({ status: 403, message: 'This account is suspended' });
      return done(null, toAuthUser(row));
    } catch (err) {
      return done(err);
    }
  }),
);

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.JWT_SECRET,
      algorithms: ['HS256'],
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
