import { inTransaction, pool } from '../../lib/pool';
import { READABLE, SHAREABLE, VISIBLE_OR_ADMIN } from '../notes/repository';
import { ASSETS } from './config';

export interface Asset {
  id: number;
  kind: 'image' | 'video';
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
}

/** What `sendAsset` needs to serve an asset; a video also has a poster image. */
export interface StoredFile {
  key: string;
  mime: string;
  posterKey: string | null;
}

const ASSET_COLS = `ast_id AS "id", ast_kind AS "kind", ast_mime AS "mime", ast_bytes AS "bytes",
                    ast_width AS "width", ast_height AS "height"`;

/** The user's stored bytes, counting every asset that still holds a file. */
const USED_BYTES = `SELECT COALESCE(SUM(ast_bytes), 0)::BIGINT AS used FROM "ASSET_T"
                    WHERE ast_usr_id = $1 AND ast_status IN ('pending', 'ready')`;

export interface NewAsset {
  kind: 'image' | 'video';
  key: string;
  posterKey?: string;
  mime: string;
  /** Stored bytes, counted against the quota (a video counts its poster too). */
  bytes: number;
  width: number;
  height: number;
  durationMs?: number;
}

/** Records a ready asset, or returns 'quota' when it would take the user past the storage quota (D43). The advisory lock makes concurrent uploads by one user check and insert one after the other. */
export function insertAsset(userId: number, a: NewAsset): Promise<Asset | 'quota'> {
  return inTransaction(async (c) => {
    await c.query(`SELECT pg_advisory_xact_lock(hashtext('asset_quota'), $1)`, [userId]);
    const { rows: used } = await c.query<{ used: string }>(USED_BYTES, [userId]);
    if (Number(used[0].used) + a.bytes > ASSETS.quotaBytes) return 'quota';
    const { rows } = await c.query<Asset>(
      `INSERT INTO "ASSET_T" (ast_usr_id, ast_kind, ast_key, ast_poster_key, ast_mime, ast_bytes, ast_width, ast_height,
                              ast_duration_ms, ast_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ready')
       RETURNING ${ASSET_COLS}`,
      [userId, a.kind, a.key, a.posterKey ?? null, a.mime, a.bytes, a.width, a.height, a.durationMs ?? null],
    );
    return rows[0];
  });
}

/**
 * The stored file of a ready asset when viewer `viewerId` may read it: its owner, or anyone who may read a note that
 * references it, by the same rules as the note itself (blocks, friends-only, hidden, deleted, collaborators; D49, R30).
 */
export async function getReadableAsset(id: number, viewerId: number): Promise<StoredFile | undefined> {
  const { rows } = await pool.query<StoredFile>(
    `SELECT a.ast_key AS "key", a.ast_mime AS "mime", a.ast_poster_key AS "posterKey" FROM "ASSET_T" a
     WHERE a.ast_id = $2 AND a.ast_status = 'ready'
       AND (a.ast_usr_id = $1 OR EXISTS (
             SELECT 1 FROM "POST_ASSET_T" pa JOIN "POST_T" p ON p.pst_id = pa.pas_pst_id
             WHERE pa.pas_ast_id = a.ast_id AND (${READABLE} OR ${VISIBLE_OR_ADMIN})))`,
    [viewerId, id],
  );
  return rows[0];
}

/** The kind of each given asset that is ready and either owned by `userId` or already linked to note `postId`; others are absent from the map. */
export async function usableAssetKinds(
  ids: number[],
  userId: number,
  postId: number | null,
): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const { rows } = await pool.query<{ id: number; kind: string }>(
    `SELECT ast_id AS "id", ast_kind AS "kind" FROM "ASSET_T" a
     WHERE ast_id = ANY($1::INT[]) AND ast_status = 'ready'
       AND (ast_usr_id = $2 OR EXISTS (SELECT 1 FROM "POST_ASSET_T" pa WHERE pa.pas_pst_id = $3 AND pa.pas_ast_id = a.ast_id))`,
    [ids, userId, postId],
  );
  return new Map(rows.map((r) => [r.id, r.kind]));
}

/** The stored file of a ready asset that note `noteId` references and that a share link may reach (the note is SHAREABLE). */
export async function getLinkedAsset(noteId: number, assetId: number): Promise<StoredFile | undefined> {
  const { rows } = await pool.query<StoredFile>(
    `SELECT a.ast_key AS "key", a.ast_mime AS "mime", a.ast_poster_key AS "posterKey"
     FROM "ASSET_T" a JOIN "POST_ASSET_T" pa ON pa.pas_ast_id = a.ast_id JOIN "POST_T" p ON p.pst_id = pa.pas_pst_id
     WHERE pa.pas_pst_id = $1 AND a.ast_id = $2 AND a.ast_status = 'ready' AND ${SHAREABLE}`,
    [noteId, assetId],
  );
  return rows[0];
}

/** Marks old assets that no live note references as deleted and returns their storage keys, for the caller to remove. */
export async function takeUnlinkedAssets(): Promise<string[]> {
  const { rows } = await pool.query<{ key: string; posterKey: string | null }>(
    `WITH stale AS (
       SELECT a.ast_id FROM "ASSET_T" a
       WHERE a.ast_status IN ('pending', 'ready') AND a.ast_created_at < NOW() - make_interval(hours => $1)
         AND NOT EXISTS (SELECT 1 FROM "POST_ASSET_T" pa JOIN "POST_T" p ON p.pst_id = pa.pas_pst_id
                         WHERE pa.pas_ast_id = a.ast_id AND p.pst_status <> 'deleted')
       FOR UPDATE SKIP LOCKED)
     UPDATE "ASSET_T" a SET ast_status = 'deleted' FROM stale WHERE a.ast_id = stale.ast_id
     RETURNING a.ast_key AS "key", a.ast_poster_key AS "posterKey"`,
    [ASSETS.unlinkedAgeHours],
  );
  return rows.flatMap((r) => (r.posterKey ? [r.key, r.posterKey] : [r.key]));
}
