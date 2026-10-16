import type { Request, RequestHandler } from 'express';
import { passport } from './passport';
import { guestReadLimiter } from './rateLimit';
import { type AuthUser, GUEST_ID, type Role } from '../users/repository';

export const requireAuth: RequestHandler = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err: unknown, user: AuthUser | false) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * For guest-readable GETs (R31, D44): a valid cookie attaches the user; a missing, invalid or expired one makes a guest,
 * rate-limited by IP. `X-Viewer: guest` lets a client that thinks it is signed in notice its session expired (D45).
 * Signed-in answers say `X-Viewer: user`: a 304 keeps the cached response's headers unless the 304 replaces them, so
 * without it a guest copy revalidated after login would still read as guest and end the new session.
 */
export const optionalAuth: RequestHandler = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err: unknown, user: AuthUser | false) => {
    if (err) return next(err);
    if (!user) {
      res.set('X-Viewer', 'guest');
      return guestReadLimiter(req, res, next);
    }
    res.set('X-Viewer', 'user');
    req.user = user;
    next();
  })(req, res, next);
};

/** Use after requireAuth or optionalAuth: the signed-in user's id, or GUEST_ID. */
export const viewerId = (req: Request): number => req.user?.id ?? GUEST_ID;

/** Use after requireAuth. Checks the role loaded from the database, not the token claim. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

/** Use after requireAuth. Restricted accounts may read but not create or edit content (UC21). */
export const requireActive: RequestHandler = (req, res, next) => {
  if (req.user?.status !== 'active') {
    return res.status(403).json({ error: 'Your account is restricted and cannot perform this action' });
  }
  next();
};

/** The user requireAuth attached; throws 401 if a route forgot to use it. */
export function me(req: Request): AuthUser {
  if (!req.user) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return req.user;
}
