import { randomUUID } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { idParam } from '../../lib/validation';
import { storage } from '../../lib/storage';
import { me, optionalAuth, requireActive, requireAuth, viewerId } from '../auth/middleware';
import { uploadLimiter } from '../auth/rateLimit';
import { ASSETS, assetUrl } from './config';
import { reencodeImage } from './image';
import { getReadableAsset, insertImage } from './repository';

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
assetsRouter.post('/images', requireAuth, requireActive, uploadLimiter, readUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const result = await reencodeImage(req.file.buffer);
  if (!result.ok) return res.status(400).json({ error: result.error });
  const { data, width, height } = result.image;

  const key = `i/${randomUUID()}.webp`;
  await storage.put(key, data);
  let asset;
  try {
    asset = await insertImage(me(req).id, key, data.length, width, height);
  } catch (err) {
    await storage.remove(key);
    throw err;
  }
  if (asset === 'quota') {
    await storage.remove(key);
    return res.status(413).json({ error: 'Storage limit of 500 MB reached. Delete notes or images to free space' });
  }
  res.status(201).json({ asset: { ...asset, url: assetUrl(asset.id) } });
});

assetsRouter.get('/:id/file', optionalAuth, async (req, res) => {
  const asset = await getReadableAsset(Number(req.params.id), viewerId(req));
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  const url = await storage.signedUrl(asset.key);
  if (url) return res.redirect(302, url);
  const body = await storage.read(asset.key);
  if (!body) return res.status(404).json({ error: 'Asset not found' });
  // Readability depends on who asks, so shared caches must not keep it; the owner's browser may for a few minutes.
  res
    .set({
      'Content-Type': asset.mime,
      'Cache-Control': 'private, max-age=300',
      'Cross-Origin-Resource-Policy': 'same-site',
    })
    .send(body);
});
