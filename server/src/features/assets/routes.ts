import { randomUUID } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { idParam } from '../../lib/validation';
import { storage } from '../../lib/storage';
import { me, optionalAuth, requireActive, requireAuth, viewerId } from '../auth/middleware';
import { uploadLimiter } from '../auth/rateLimit';
import { env } from '../../lib/env';
import { storageFits, UsageLimitError } from '../usage/service';
import { ASSETS, assetUrl } from './config';
import { reencodeImage } from './image';
import { getReadableAsset, insertImage } from './repository';
import { sendAsset } from './service';

export const assetsRouter = Router();
assetsRouter.param('id', idParam('Asset not found'));

// Memory storage is safe at this cap (5 MB a request); multer stops reading a body that passes it.
const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ASSETS.maxImageBytes, files: 1, fields: 0 },
});

const readUpload: RequestHandler = (req, res, next) =>
  receive.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return void res.status(413).json({ error: 'Image must be at most 5 MB' });
    }
    res.status(400).json({ error: 'Invalid upload' });
  });

// requireAuth, requireActive and the write limiter (app.ts) run before the body is read; CSRF runs before them all.
const uploadsOpen: RequestHandler = (_req, res, next) =>
  env.UPLOADS_DISABLED ? void res.status(503).json({ error: 'Uploads are turned off' }) : next();

assetsRouter.post('/images', requireAuth, requireActive, uploadLimiter, uploadsOpen, readUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const result = await reencodeImage(req.file.buffer);
  if (!result.ok) return res.status(400).json({ error: result.error });
  const { data, width, height } = result.image;

  if (!(await storageFits(data.length))) {
    return res.status(507).json({ error: 'Image storage is full. Uploads are paused' });
  }

  const key = `i/${randomUUID()}.webp`;
  try {
    await storage.put(key, data);
  } catch (err) {
    if (err instanceof UsageLimitError) return res.status(503).json({ error: err.message });
    throw err;
  }
  let asset;
  try {
    asset = await insertImage(me(req).id, key, data.length, width, height);
  } catch (err) {
    await storage.remove(key);
    throw err;
  }
  if (asset === 'quota') {
    await storage.remove(key);
    return res.status(413).json({
      error: 'Storage limit of 500 MB reached. Delete notes or images to free space',
    });
  }
  res.status(201).json({ asset: { ...asset, url: assetUrl(asset.id) } });
});

assetsRouter.get('/:id/file', optionalAuth, async (req, res) => {
  const asset = await getReadableAsset(Number(req.params.id), viewerId(req));
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  await sendAsset(res, asset);
});
