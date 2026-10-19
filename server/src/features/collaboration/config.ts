import { COLLAB_REQUEST_MESSAGE_MAX } from '@notalah/shared';

/** Collaboration settings (R30, D46). Not ranking constants, so they live with the feature. */
export const COLLABORATION = Object.freeze({
  /** A soft edit lock lasts this long unless renewed; an editor renews it while the editor is open. */
  lockTtlSeconds: 120,
  /** Bytes of randomness in a share-link token (base64url encoded, 43 characters). */
  tokenBytes: 32,
  /** Longest optional message on a request to collaborate. */
  requestMessageMax: COLLAB_REQUEST_MESSAGE_MAX,
});
