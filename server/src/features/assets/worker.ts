import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { env } from '../../lib/env';
import { logger } from '../../lib/logger';
import { storage } from '../../lib/storage';
import { VIDEO, videoProfile, type VideoProfile } from './config';
import {
  claimVideoJob,
  completeVideoJob,
  failVideoJob,
  renewVideoLease,
  retryVideoJob,
  type VideoJob,
} from './repository';
import { processVideo } from './video';

/** The profile this process runs, from VIDEO_PROFILE and VIDEO_CONCURRENCY (R40, D67). */
export const activeVideoProfile = videoProfile({ profile: env.VIDEO_PROFILE, concurrency: env.VIDEO_CONCURRENCY });

const removeQuietly = (key: string) =>
  storage.remove(key).catch((err: unknown) => logger.error({ err, key }, 'video file removal failed'));

/** Downloads the original, processes it and stores the result; throws only on errors worth a retry (storage, database). */
async function run(job: VideoJob, profile: VideoProfile): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), VIDEO.tmpPrefix));
  const stored: string[] = [];
  try {
    const original = await storage.read(job.key);
    if (!original || 'unsatisfiable' in original) {
      await failVideoJob(job, 'The uploaded file is missing. Upload it again');
      return;
    }
    const input = path.join(dir, 'input');
    await pipeline(original.stream, createWriteStream(input));
    const result = await processVideo(input, dir, { profile });
    if (!result.ok) {
      if (await failVideoJob(job, result.error)) await removeQuietly(job.key);
      return;
    }
    const { video } = result;
    const id = randomUUID();
    const key = `v/${id}.mp4`;
    const posterKey = `p/${id}.webp`;
    stored.push(key);
    await storage.put(key, await readFile(video.file));
    stored.push(posterKey);
    await storage.put(posterKey, video.poster);
    const done = await completeVideoJob(job, {
      key,
      posterKey,
      bytes: video.bytes + video.poster.length,
      width: video.width,
      height: video.height,
      durationMs: video.durationMs,
    });
    if (done) await removeQuietly(job.key);
    else await Promise.all(stored.map(removeQuietly));
  } catch (err) {
    await Promise.all(stored.map(removeQuietly));
    throw err;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Claims and runs one job; false when none was waiting (R40, D67). An unexpected error puts the job back with a growing
 * delay; the attempt after `maxAttempts` marks it failed instead, as does a claim whose earlier holder died that often.
 */
export async function runNextVideoJob(profile: VideoProfile = activeVideoProfile): Promise<boolean> {
  const job = await claimVideoJob(VIDEO.leaseMs);
  if (!job) return false;
  if (job.attempts > VIDEO.maxAttempts) {
    if (await failVideoJob(job, 'Video processing failed. Try uploading it again')) await removeQuietly(job.key);
    return true;
  }
  const heartbeat = setInterval(
    () =>
      void renewVideoLease(job, VIDEO.leaseMs).catch((err: unknown) =>
        logger.error({ err, jobId: job.id }, 'video lease renewal failed'),
      ),
    VIDEO.heartbeatMs,
  );
  try {
    await run(job, profile);
  } catch (err) {
    logger.error({ err, jobId: job.id, assetId: job.assetId, attempt: job.attempts }, 'video job failed');
    const message = err instanceof Error ? err.message : 'Video processing failed';
    if (job.attempts >= VIDEO.maxAttempts) {
      if (await failVideoJob(job, 'Video processing failed. Try uploading it again')) await removeQuietly(job.key);
    } else await retryVideoJob(job, message, VIDEO.retryDelayMs * job.attempts);
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}

/** Sleeping worker slots in this process; an upload here wakes them so a job starts without waiting for the next poll. */
const sleepers = new Set<() => void>();

export function wakeVideoWorker(): void {
  for (const wake of sleepers) wake();
}

/**
 * Runs `profile.concurrency` loops that each claim one job at a time until stopped. Started by `server.ts` unless
 * VIDEO_WORKER_IN_PROCESS=false, and by `scripts/videoWorker.ts` as a separate service; the code is the same (D67).
 */
export function startVideoWorker(profile: VideoProfile = activeVideoProfile): { stop: () => Promise<void> } {
  let stopped = false;
  const idle = () =>
    new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        sleepers.delete(done);
        resolve();
      };
      const timer = setTimeout(done, VIDEO.idlePollMs);
      sleepers.add(done);
    });
  const loop = async () => {
    while (!stopped) {
      const worked = await runNextVideoJob(profile).catch((err: unknown) => {
        logger.error({ err }, 'video worker could not claim a job');
        return false;
      });
      if (!worked && !stopped) await idle();
    }
  };
  const loops = Array.from({ length: profile.concurrency }, loop);
  logger.info({ profile: profile.name, concurrency: profile.concurrency }, 'video worker started');
  return {
    stop: async () => {
      stopped = true;
      wakeVideoWorker();
      await Promise.all(loops);
    },
  };
}
