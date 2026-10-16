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
  /** An asset no note references is removed once it is this old. */
  unlinkedAgeHours: 24,
});

/** Formats accepted by content sniffing; a GIF is stored as its first frame, a still WebP (D43). */
export const IMAGE_FORMATS: ReadonlySet<string | undefined> = new Set(['jpeg', 'png', 'webp', 'gif']);

/** The route that serves an asset's file; notes carry this URL in their `assets` map (R21 spec 2.4). The notes SQL builds the same string. */
export const assetUrl = (id: number) => `/api/assets/${id}/file`;
