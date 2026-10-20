import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { idParam } from '../../lib/validation';
import { env } from '../../lib/env';
import { storage } from '../../lib/storage';
import { me, optionalAuthForFiles, requireActive, requireAuth, viewerId } from '../auth/middleware';
import { fileLimiter, uploadLimiter, videoUploadLimiter } from './rateLimit';
import { storageFits, UsageLimitError } from '../usage/service';
import { ASSETS, assetUrl, VIDEO } from './config';
import { reencodeImage } from './image';
import { parseKeyset } from '../../lib/keyset';
import { getOwnAsset, getReadableAsset, insertAsset, listMyImages } from './repository';
import { sendAsset } from './service';
import { inspectVideo } from './video';
import { activeVideoProfile, wakeVideoWorker } from './worker';

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

  if (!(await storageFits(data.length))) {
    return res.status(507).json({ error: 'Image storage is full. Uploads are paused' });
  }

  const key = `i/${randomUUID()}.webp`;
  try {
    await storage.put(key, data);
  } catch (err) {
    if (err instanceof UsageLimitError) return res.status(503).json({ error: err.message });
    await storage.remove(key).catch(() => {});
    throw err;
  }
  let asset;
  try {
    asset = await insertAsset(me(req).id, {
      kind: 'image',
      key,
      mime: 'image/webp',
      bytes: data.length,
      width,
      height,
    });
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

assetsRouter.get('/images', requireAuth, async (req, res) => {
  const page = parseKeyset(req, res, 2, 30);
  if (!page) return;
  const { items, nextCursor } = await listMyImages(me(req).id, page);
  res.json({ assets: items.map((a) => ({ ...a, url: assetUrl(a.id) })), nextCursor });
});

// Videos stream to a temp file, not memory; the directory is removed when the response ends, however it ends (R29, D59).
const receiveVideo = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => cb(null, req.res!.locals.workDir as string),
    filename: (_req, _file, cb) => cb(null, 'input'),
  }),
  limits: { fileSize: VIDEO.maxBytes, files: 1, fields: 0 },
});

const prepareVideoUpload: RequestHandler = async (_req, res, next) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), VIDEO.tmpPrefix));
  res.locals.workDir = dir;
  res.on('close', () => void rm(dir, { recursive: true, force: true }).catch(() => undefined));
  next();
};

const readVideo: RequestHandler = (req, res, next) =>
  receiveVideo.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return void res.status(413).json({ error: 'Video must be at most 50 MB' });
    }
    res.status(400).json({ error: 'Invalid upload' });
  });

/** Refuses before the body is read when uploads are off or no video-sized file could fit, so a rejected upload costs no bandwidth or disk. */
const videoAllowed: RequestHandler = async (_req, res, next) => {
  if (env.UPLOADS_DISABLED) return void res.status(503).json({ error: 'Uploads are turned off' });
  if (!(await storageFits(VIDEO.maxBytes))) {
    return void res.status(507).json({ error: 'Video storage is full. Uploads are paused' });
  }
  next();
};

/** The active video limits, for the editor's picker to state (R40, D67). */
assetsRouter.get('/videos/limits', requireAuth, (_req, res) => {
  res.json({
    limits: {
      profile: activeVideoProfile.name,
      maxSeconds: VIDEO.maxSeconds,
      maxBytes: VIDEO.maxBytes,
      maxHeight: activeVideoProfile.maxHeight,
    },
  });
});

/**
 * Checks the upload with ffprobe only, stores the original as uploaded (metered like any put) and queues a job; the
 * answer is 202 with status 'processing' before any encoding (R40, D67). The worker makes it 'ready' or 'failed'.
 */
assetsRouter.post(
  '/videos',
  requireAuth,
  requireActive,
  videoUploadLimiter,
  videoAllowed,
  prepareVideoUpload,
  readVideo,
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No video uploaded' });
    const checked = await inspectVideo(req.file.path);
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    if (!(await storageFits(req.file.size))) {
      return res.status(507).json({ error: 'Video storage is full. Uploads are paused' });
    }

    const key = `o/${randomUUID()}.orig`;
    try {
      await storage.put(key, await readFile(req.file.path));
      const asset = await insertAsset(me(req).id, {
        kind: 'video',
        key,
        mime: 'video/mp4',
        bytes: req.file.size,
        width: checked.width,
        height: checked.height,
        durationMs: checked.durationMs,
      });
      if (asset === 'quota') {
        await storage.remove(key);
        return res.status(413).json({ error: 'Storage limit of 500 MB reached. Delete notes or media to free space' });
      }
      wakeVideoWorker();
      return res.status(202).json({ asset: { ...asset, url: assetUrl(asset.id) } });
    } catch (err) {
      await storage.remove(key).catch(() => {});
      if (err instanceof UsageLimitError) return res.status(503).json({ error: err.message });
      throw err;
    }
  },
);

assetsRouter.get('/:id/file', optionalAuthForFiles, fileLimiter, async (req, res) => {
  const asset = await getReadableAsset(Number(req.params.id), viewerId(req));
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  await sendAsset(req, res, asset);
});

/** The owner's view of one upload, which the editor polls while a video is processing (R40). */
assetsRouter.get('/:id', requireAuth, async (req, res) => {
  const asset = await getOwnAsset(Number(req.params.id), me(req).id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  res.json({ asset: { ...asset, url: assetUrl(asset.id) } });
});
