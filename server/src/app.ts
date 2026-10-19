import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { env } from './lib/env';
import { reportError } from './lib/errorReporting';
import { requestLogger } from './lib/logger';
import { passport } from './features/auth/passport';
import { adminRouter } from './features/moderation/routes';
import { assetsRouter } from './features/assets/routes';
import { authRouter } from './features/auth/routes';
import { collaborationRouter } from './features/collaboration/routes';
import { writeLimiter } from './features/auth/rateLimit';
import { engagementRouter } from './features/engagement/routes';
import { feedRouter } from './features/feed/routes';
import { messagingRouter } from './features/messaging/routes';
import { healthRouter } from './lib/health';
import { modulesRouter, programmesRouter, termsRouter } from './features/modules/routes';
import { notesRouter } from './features/notes/routes';
import { notificationsRouter } from './features/notifications/routes';
import { searchRouter } from './features/search/routes';
import { unsplashRouter } from './features/unsplash/routes';
import { usageRouter } from './features/usage/routes';
import { usersRouter } from './features/users/routes';
import { verificationRouter } from './features/verification/routes';

export const app = express();

// Behind the Vite dev proxy every request arrives from loopback; trust its X-Forwarded-For (D17).
app.set('trust proxy', 'loopback');

app.use(requestLogger);
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
    exposedHeaders: ['X-Viewer'],
  }),
);

// CSRF (D35): a cross-site page cannot add this header without a preflight, which CORS refuses for other origins.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
app.use('/api', (req, res, next) => {
  if (SAFE_METHODS.has(req.method) || req.get('X-Requested-With') === 'notalah') return next();
  res.status(403).json({ error: 'Forbidden' });
});
// Write limit per user, or per IP when signed out, counted in Postgres so it holds across instances (D40).
app.use('/api', (req, res, next) => (SAFE_METHODS.has(req.method) ? next() : writeLimiter(req, res, next)));
// A full deck (30 slides of up to 48 KB, R21) outgrows the global limit; the first parser to run wins, the later one skips.
app.use('/api/notes', express.json({ limit: '2mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(passport.initialize());

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin/usage', usageRouter);
app.use('/api/admin', adminRouter);
app.use('/api/modules', modulesRouter);
app.use('/api/programmes', programmesRouter);
app.use('/api/terms', termsRouter);
app.use('/api/feed', feedRouter);
app.use('/api/search', searchRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api', verificationRouter);
app.use('/api', collaborationRouter); // before notesRouter so /notes/shared is not read as a note id
app.use('/api', messagingRouter);
app.use('/api', engagementRouter); // before notesRouter so its /notes/:id/* routes authenticate once
app.use('/api/assets', assetsRouter);
app.use('/api/notes', notesRouter);
app.use('/api/unsplash', unsplashRouter);
app.use('/api/users', usersRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Express 5 forwards rejected async handlers here.
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const status = typeof err?.status === 'number' ? err.status : 500;
  if (status >= 500) {
    res.err = err;
    reportError(err, { requestId: req.id as string });
  }
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
};
app.use(errorHandler);
