import type { Request, RequestHandler } from 'express';
import { passport } from './passport';
import type { AuthUser, Role } from '../users/repository';

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

/** The user requireAuth attached; throws 401 if a route forgot to use it. */
export function me(req: Request): AuthUser {
  if (!req.user) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return req.user;
}
