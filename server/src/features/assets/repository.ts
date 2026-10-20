import { fromMicros, type KeysetPage, micros, toPage } from '../../lib/keyset';
import { inTransaction, pool } from '../../lib/pool';
import { READABLE, SHAREABLE, VISIBLE_OR_ADMIN } from '../notes/repository';
import { ASSETS, LINKABLE_STATUSES } from './config';

type AssetStatus = 'processing' | 'ready' | 'failed';

export interface Asset {
  id: number;
  kind: 'image' | 'video';
  status: AssetStatus;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
}

/** What `sendAsset` needs to serve an asset; a video also has a poster image, and only a ready one has a file. */
export interface StoredFile {
  status: AssetStatus;
  key: string;
  mime: string;
  posterKey: string | null;
}

const ASSET_COLS = `ast_id AS "id", ast_kind AS "kind", ast_status AS "status", ast_mime AS "mime", ast_bytes AS "bytes",
                    ast_width AS "width", ast_height AS "height"`;

/** The user's stored bytes, counting every asset that still holds a file. */
const USED_BYTES = `SELECT COALESCE(SUM(ast_bytes), 0)::BIGINT AS used FROM "ASSET_T"
                    WHERE ast_usr_id = $1 AND ast_status IN ('pending', 'processing', 'ready')`;

interface NewAsset {
  kind: 'image' | 'video';
  key: string;
  posterKey?: string;
  mime: string;
  /** Stored bytes, counted against the quota (a video counts its poster too). */
  bytes: number;
  width: number;
  height: number;
  durationMs?: number | null;
}

/**
 * Records an asset, or returns 'quota' when it would take the user past the storage quota (D43). An image is ready at
 * once; a video is the original upload, 'processing' with a queued job for the worker (R40). The advisory lock makes
 * concurrent uploads by one user check and insert one after the other.
 */
export function insertAsset(userId: number, a: NewAsset): Promise<Asset | 'quota'> {
  return inTransaction(async (c) => {
    await c.query(`SELECT pg_advisory_xact_lock(hashtext('asset_quota'), $1)`, [userId]);
    const { rows: used } = await c.query<{ used: string }>(USED_BYTES, [userId]);
    if (Number(used[0].used) + a.bytes > ASSETS.quotaBytes) return 'quota';
    const { rows } = await c.query<Asset>(
      `INSERT INTO "ASSET_T" (ast_usr_id, ast_kind, ast_key, ast_poster_key, ast_mime, ast_bytes, ast_width, ast_height,
                              ast_duration_ms, ast_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${ASSET_COLS}`,
      [
        userId,
        a.kind,
        a.key,
        a.posterKey ?? null,
        a.mime,
        a.bytes,
        a.width,
        a.height,
        a.durationMs ?? null,
        a.kind === 'video' ? 'processing' : 'ready',
      ],
    );
    if (a.kind === 'video') await c.query(`INSERT INTO "VIDEO_JOB_T" (vjb_ast_id) VALUES ($1)`, [rows[0].id]);
    return rows[0];
  });
}

/**
 * The stored file of a linkable asset (ready, processing or failed) when viewer `viewerId` may read it: its owner, or anyone who may read a note that
 * references it, by the same rules as the note itself (blocks, friends-only, hidden, deleted, collaborators; D49, R30).
 */
export async function getReadableAsset(id: number, viewerId: number): Promise<StoredFile | undefined> {
  const { rows } = await pool.query<StoredFile>(
    `SELECT a.ast_status AS "status", a.ast_key AS "key", a.ast_mime AS "mime", a.ast_poster_key AS "posterKey"
     FROM "ASSET_T" a
     WHERE a.ast_id = $2 AND a.ast_status IN ${LINKABLE_STATUSES}
       AND (a.ast_usr_id = $1 OR EXISTS (
             SELECT 1 FROM "POST_ASSET_T" pa JOIN "POST_T" p ON p.pst_id = pa.pas_pst_id
             WHERE pa.pas_ast_id = a.ast_id AND (${READABLE} OR ${VISIBLE_OR_ADMIN})))`,
    [viewerId, id],
  );
  return rows[0];
}

/** The kind of each given asset that is linkable and either owned by `userId` or already linked to note `postId`; others are absent from the map. */
export async function usableAssetKinds(
  ids: number[],
  userId: number,
  postId: number | null,
): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const { rows } = await pool.query<{ id: number; kind: string }>(
    `SELECT ast_id AS "id", ast_kind AS "kind" FROM "ASSET_T" a
     WHERE ast_id = ANY($1::INT[]) AND ast_status IN ${LINKABLE_STATUSES}
       AND (ast_usr_id = $2 OR EXISTS (SELECT 1 FROM "POST_ASSET_T" pa WHERE pa.pas_pst_id = $3 AND pa.pas_ast_id = a.ast_id))`,
    [ids, userId, postId],
  );
  return new Map(rows.map((r) => [r.id, r.kind]));
}

/** The stored file of a linkable asset that note `noteId` references and that a share link may reach (the note is SHAREABLE). */
export async function getLinkedAsset(noteId: number, assetId: number): Promise<StoredFile | undefined> {
  const { rows } = await pool.query<StoredFile>(
    `SELECT a.ast_status AS "status", a.ast_key AS "key", a.ast_mime AS "mime", a.ast_poster_key AS "posterKey"
     FROM "ASSET_T" a JOIN "POST_ASSET_T" pa ON pa.pas_ast_id = a.ast_id JOIN "POST_T" p ON p.pst_id = pa.pas_pst_id
     WHERE pa.pas_pst_id = $1 AND a.ast_id = $2 AND a.ast_status IN ${LINKABLE_STATUSES} AND ${SHAREABLE}`,
    [noteId, assetId],
  );
  return rows[0];
}

/** Marks old assets that no live note references as deleted (a video still processing is left to the worker) and returns their storage keys (a video also has a poster key), for the caller to remove. */
export async function takeUnlinkedAssets(): Promise<{ key: string; posterKey: string | null }[]> {
  const { rows } = await pool.query<{ key: string; posterKey: string | null }>(
    `WITH stale AS (
       SELECT a.ast_id FROM "ASSET_T" a
       WHERE a.ast_status IN ('pending', 'ready', 'failed') AND a.ast_created_at < NOW() - make_interval(hours => $1)
         AND NOT EXISTS (SELECT 1 FROM "POST_ASSET_T" pa JOIN "POST_T" p ON p.pst_id = pa.pas_pst_id
                         WHERE pa.pas_ast_id = a.ast_id AND p.pst_status <> 'deleted')
       FOR UPDATE SKIP LOCKED)
     UPDATE "ASSET_T" a SET ast_status = 'deleted' FROM stale WHERE a.ast_id = stale.ast_id
     RETURNING a.ast_key AS "key", a.ast_poster_key AS "posterKey"`,
    [ASSETS.unlinkedAgeHours],
  );
  return rows;
}

/** One page of the user's ready images, newest first, for the editor's "Your uploads"; keyset on (created_at, id), D40. */
export async function listMyImages(
  userId: number,
  { cursor, limit }: KeysetPage,
): Promise<{ items: Asset[]; nextCursor: string | null }> {
  const { rows } = await pool.query<Asset & { cursor: string }>(
    `SELECT ${ASSET_COLS}, ${micros('ast_created_at')} || '_' || ast_id AS "cursor"
     FROM "ASSET_T"
     WHERE ast_usr_id = $1 AND ast_kind = 'image' AND ast_status = 'ready'
       AND ($2::BIGINT IS NULL OR (ast_created_at, ast_id) < (${fromMicros('$2')}, $3::INT))
     ORDER BY ast_created_at DESC, ast_id DESC
     LIMIT $4`,
    [userId, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
  );
  return toPage(rows, limit);
}

/** The owner's view of one asset, for the editor to poll a video's status (R40); a failed one carries the reason. */
export async function getOwnAsset(id: number, userId: number): Promise<(Asset & { error: string | null }) | undefined> {
  const { rows } = await pool.query<Asset & { error: string | null }>(
    `SELECT ${ASSET_COLS}, CASE WHEN ast_status = 'failed' THEN j.vjb_last_error END AS "error"
     FROM "ASSET_T" LEFT JOIN "VIDEO_JOB_T" j ON j.vjb_ast_id = ast_id
     WHERE ast_id = $1 AND ast_usr_id = $2 AND ast_status IN ${LINKABLE_STATUSES}`,
    [id, userId],
  );
  return rows[0];
}

/** A claimed job; `attempts` doubles as the claim token, so a worker whose lease lapsed cannot finish a job another took. */
export interface VideoJob {
  id: number;
  assetId: number;
  attempts: number;
  /** Storage key of the original upload. */
  key: string;
}

/**
 * Claims the oldest open job whose lease has lapsed: queued, waiting out a retry delay, or running in a process that
 * died (R40, D67). SKIP LOCKED lets any number of workers claim at once without taking the same job.
 */
export async function claimVideoJob(leaseMs: number): Promise<VideoJob | undefined> {
  const { rows } = await pool.query<VideoJob>(
    `UPDATE "VIDEO_JOB_T" j
     SET vjb_status = 'running', vjb_attempts = j.vjb_attempts + 1,
         vjb_locked_until = NOW() + $1::INT * INTERVAL '1 millisecond', vjb_updated_at = NOW()
     FROM "ASSET_T" a
     WHERE a.ast_id = j.vjb_ast_id
       AND j.vjb_id = (SELECT vjb_id FROM "VIDEO_JOB_T"
                       WHERE vjb_status IN ('queued', 'running') AND vjb_locked_until <= NOW()
                       ORDER BY vjb_locked_until, vjb_id
                       LIMIT 1
                       FOR UPDATE SKIP LOCKED)
     RETURNING j.vjb_id AS "id", j.vjb_ast_id AS "assetId", j.vjb_attempts AS "attempts", a.ast_key AS "key"`,
    [leaseMs],
  );
  return rows[0];
}

/** SQL: job $1 is still running under claim token $2. */
const OWNED = `vjb_id = $1 AND vjb_attempts = $2 AND vjb_status = 'running'`;

/** Pushes the lease forward while the job runs; false when the claim was lost. */
export async function renewVideoLease(job: VideoJob, leaseMs: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE "VIDEO_JOB_T" SET vjb_locked_until = NOW() + $3::INT * INTERVAL '1 millisecond', vjb_updated_at = NOW()
     WHERE ${OWNED}`,
    [job.id, job.attempts, leaseMs],
  );
  return rowCount === 1;
}

interface FinishedVideo {
  key: string;
  posterKey: string;
  bytes: number;
  width: number;
  height: number;
  durationMs: number;
}

/** Points the asset at the processed file and marks it ready; false when the claim was lost, leaving the asset untouched. */
export function completeVideoJob(job: VideoJob, v: FinishedVideo): Promise<boolean> {
  return inTransaction(async (c) => {
    const { rowCount } = await c.query(
      `UPDATE "VIDEO_JOB_T" SET vjb_status = 'done', vjb_last_error = NULL, vjb_updated_at = NOW() WHERE ${OWNED}`,
      [job.id, job.attempts],
    );
    if (rowCount !== 1) return false;
    // shortcut: the quota was checked against the original's size, so a re-encode that grows can overshoot it by under 50 MB; check it here if that matters.
    await c.query(
      `UPDATE "ASSET_T"
       SET ast_key = $2, ast_poster_key = $3, ast_mime = 'video/mp4', ast_bytes = $4, ast_width = $5, ast_height = $6,
           ast_duration_ms = $7, ast_status = 'ready'
       WHERE ast_id = $1 AND ast_status = 'processing'`,
      [job.assetId, v.key, v.posterKey, v.bytes, v.width, v.height, v.durationMs],
    );
    return true;
  });
}

/** Marks the job and its asset failed with a reason the owner sees; false when the claim was lost. */
export function failVideoJob(job: VideoJob, error: string): Promise<boolean> {
  return inTransaction(async (c) => {
    const { rowCount } = await c.query(
      `UPDATE "VIDEO_JOB_T" SET vjb_status = 'failed', vjb_last_error = LEFT($3, 200), vjb_updated_at = NOW()
       WHERE ${OWNED}`,
      [job.id, job.attempts, error],
    );
    if (rowCount !== 1) return false;
    await c.query(`UPDATE "ASSET_T" SET ast_status = 'failed' WHERE ast_id = $1 AND ast_status = 'processing'`, [
      job.assetId,
    ]);
    return true;
  });
}

/** Puts the job back in the queue, claimable again after `delayMs`; `refund` gives the attempt back when the file was never at fault. */
export async function retryVideoJob(
  job: VideoJob,
  { error, delayMs, refund = false }: { error: string; delayMs: number; refund?: boolean },
): Promise<void> {
  await pool.query(
    `UPDATE "VIDEO_JOB_T"
     SET vjb_status = 'queued', vjb_last_error = LEFT($3, 200), vjb_attempts = vjb_attempts - $5::INT,
         vjb_locked_until = NOW() + $4::INT * INTERVAL '1 millisecond', vjb_updated_at = NOW()
     WHERE ${OWNED}`,
    [job.id, job.attempts, error, delayMs, refund ? 1 : 0],
  );
}
