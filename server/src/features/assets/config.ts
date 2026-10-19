/** Upload settings (R22, D43, D54). Not ranking constants, so they live with the feature. */
export const ASSETS = Object.freeze({
  /** Largest accepted image upload, in bytes, measured before re-encoding. */
  maxImageBytes: 5 * 1024 * 1024,
  /** Decoded size cap (width x height) that stops a small file from expanding into a memory bomb. */
  maxInputPixels: 50_000_000,
  /** Longest edge after re-encoding; larger images are scaled down, never up. */
  maxEdge: 2560,
  webpQuality: 80,
  /** Per-user storage, in bytes of stored (re-encoded) files, D43. */
  quotaBytes: 500 * 1024 * 1024,
  /** Image uploads per user per hour. */
  uploadsPerHour: 30,
  /** Video uploads per user per hour; each one costs CPU for ffprobe and ffmpeg (R29, D59). */
  videoUploadsPerHour: 6,
  /** Unsplash searches per user per hour. */
  unsplashSearchesPerHour: 20,
  /** An asset no note references is removed once it is this old. */
  unlinkedAgeHours: 24,
});

/** Formats accepted by content sniffing; a GIF is stored as its first frame, a still WebP (D43). */
export const IMAGE_FORMATS: ReadonlySet<string | undefined> = new Set(['jpeg', 'png', 'webp', 'gif']);

/** The route that serves an asset's file; notes carry this URL in their `assets` map (R21 spec 2.4). The notes SQL builds the same string. */
export const assetUrl = (id: number) => `/api/assets/${id}/file`;

/** The same file through a share link, for a holder who may not pass the asset route's note checks. */
export const shareAssetUrl = (token: string, id: number | string) => `/api/share/${token}/assets/${id}`;

/** Statuses of an asset a note may reference: a video still processing or one that failed stays linkable, so saving the note never drops it (R40). */
export const LINKABLE_STATUSES = `('processing', 'ready', 'failed')`;

/** Video limits (R29, D59) and the async pipeline (R40, D67). Bytes and seconds are checked on the upload, edges by the worker. */
export const VIDEO = Object.freeze({
  maxBytes: 50 * 1024 * 1024,
  maxSeconds: 90,
  /** Larger input edges are refused as absurd; anything above the profile's box but within this is scaled down. */
  maxInputEdge: 4096,
  /** A hung ffprobe at upload is killed after this long. */
  toolTimeoutMs: 60_000,
  /** A hung ffmpeg in the worker is killed after this long; a free instance encodes slowly, and nobody waits on it. */
  encodeTimeoutMs: 10 * 60_000,
  /** A claimed job's lease; the worker renews it every `heartbeatMs`, so it lapses only when the process died. */
  leaseMs: 2 * 60_000,
  heartbeatMs: 30_000,
  /** Claims of one job before it is marked failed; an unexpected error waits `retryDelayMs` times the attempt before the next. */
  maxAttempts: 3,
  retryDelayMs: 30_000,
  /** How often an idle worker looks for a job; an upload in the same process wakes it at once. */
  idlePollMs: 5_000,
  tmpPrefix: 'notalah-video-',
});

export type VideoProfileName = 'free' | 'standard';

export interface VideoProfile {
  name: VideoProfileName;
  /** The output box: long edge at most `maxWidth`, short edge at most `maxHeight`. */
  maxWidth: number;
  maxHeight: number;
  /** Jobs one worker process runs at once. */
  concurrency: number;
}

/** `VIDEO_PROFILE` presets (R40, D67): `free` suits a shared 0.1-CPU instance, `standard` a paid one. */
export function videoProfile({
  profile,
  concurrency,
}: {
  profile: VideoProfileName;
  concurrency: number;
}): VideoProfile {
  return profile === 'free'
    ? { name: 'free', maxWidth: 1280, maxHeight: 720, concurrency: 1 }
    : { name: 'standard', maxWidth: 1920, maxHeight: 1080, concurrency };
}
