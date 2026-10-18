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

/** Video limits (R29, D59). Bytes and seconds are checked on the upload, edges on the probed stream. */
export const VIDEO = Object.freeze({
  maxBytes: 50 * 1024 * 1024,
  maxSeconds: 90,
  /** Larger input edges are refused as absurd; anything above 1080p but within this is scaled down. */
  maxInputEdge: 4096,
  maxWidth: 1920,
  maxHeight: 1080,
  /** A hung ffprobe or ffmpeg is killed after this long. */
  toolTimeoutMs: 60_000,
  /** Videos processed at once; further uploads get 503 so a burst cannot starve the API of CPU. */
  maxConcurrent: 2,
  tmpPrefix: 'parp-video-',
});
