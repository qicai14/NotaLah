import type { RequestHandler } from 'express';
import { passport } from './passport';
import type { AuthUser, Role } from '../users/repository';

/** Rejects the request with 401 unless it carries a valid bearer token for an active account. */
export const requireAuth: RequestHandler = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err: unknown, user: AuthUser | false) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  })(req, res, next);
};

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
