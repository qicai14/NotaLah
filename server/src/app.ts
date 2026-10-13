import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { passport } from './auth/passport';
import { adminRouter } from './routes/admin';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';

export const app = express();

// Behind the Vite dev proxy every request arrives from loopback; trust its X-Forwarded-For (D17).
app.set('trust proxy', 'loopback');

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '1mb' }));
app.use(passport.initialize());

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
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
