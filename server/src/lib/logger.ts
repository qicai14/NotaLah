import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pino from 'pino';
import { pinoHttp } from 'pino-http';

export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.password',
      '*.currentPassword',
      '*.newPassword',
    ],
    censor: '[redacted]',
  },
});

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage, res: ServerResponse) => {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  autoLogging: { ignore: (req) => req.url?.startsWith('/api/health') ?? false },
  customProps: (req) => ({ userId: (req as IncomingMessage & { user?: { id: number } }).user?.id }),
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, path: req.url?.split('?')[0], headers: req.headers }),
  },
});
