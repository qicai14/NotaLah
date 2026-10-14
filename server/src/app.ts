import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { env } from './lib/env';
import { passport } from './features/auth/passport';
import { adminRouter } from './features/moderation/routes';
import { authRouter } from './features/auth/routes';
import { engagementRouter } from './features/engagement/routes';
import { feedRouter } from './features/feed/routes';
import { healthRouter } from './lib/health';
import { programmesRouter } from './features/modules/routes';
import { modulesRouter, notesRouter } from './features/notes/routes';
import { usersRouter } from './features/users/routes';
import { verificationRouter } from './features/verification/routes';

export const app = express();

// Behind the Vite dev proxy every request arrives from loopback; trust its X-Forwarded-For (D17).
app.set('trust proxy', 'loopback');

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true, allowedHeaders: ['Content-Type', 'X-Requested-With'] }));

// CSRF (D35): a cross-site page cannot add this header without a preflight, which CORS refuses for other origins.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
app.use('/api', (req, res, next) => {
  if (SAFE_METHODS.has(req.method) || req.get('X-Requested-With') === 'parp') return next();
  res.status(403).json({ error: 'Forbidden' });
});
app.use(express.json({ limit: '1mb' }));
app.use(passport.initialize());

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/modules', modulesRouter);
app.use('/api/programmes', programmesRouter);
app.use('/api/feed', feedRouter);
app.use('/api', verificationRouter);
app.use('/api', engagementRouter); // before notesRouter so its /notes/:id/* routes authenticate once
app.use('/api/notes', notesRouter);
app.use('/api/users', usersRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Express 5 forwards rejected async handlers here.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = typeof err?.status === 'number' ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
};
app.use(errorHandler);
