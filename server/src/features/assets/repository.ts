import { inTransaction, pool } from '../../lib/pool';
import { READABLE, VISIBLE_OR_ADMIN } from '../notes/repository';
import { ASSETS } from './config';

export interface Asset {
  id: number;
  kind: 'image' | 'video';
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
}

const ASSET_COLS = `ast_id AS "id", ast_kind AS "kind", ast_mime AS "mime", ast_bytes AS "bytes",
                    ast_width AS "width", ast_height AS "height"`;

/** The user's stored bytes, counting every asset that still holds a file. */
const USED_BYTES = `SELECT COALESCE(SUM(ast_bytes), 0)::BIGINT AS used FROM "ASSET_T"
                    WHERE ast_usr_id = $1 AND ast_status IN ('pending', 'ready')`;

/** Records a ready image, or returns 'quota' when it would take the user past the storage quota (D43). The advisory lock makes concurrent uploads by one user check and insert one after the other. */
export function insertImage(
  userId: number,
  key: string,
  bytes: number,
  width: number,
  height: number,
): Promise<Asset | 'quota'> {
  return inTransaction(async (c) => {
    await c.query(`SELECT pg_advisory_xact_lock($1)`, [userId]);
    const { rows: used } = await c.query<{ used: string }>(USED_BYTES, [userId]);
    if (Number(used[0].used) + bytes > ASSETS.quotaBytes) return 'quota';
    const { rows } = await c.query<Asset>(
      `INSERT INTO "ASSET_T" (ast_usr_id, ast_kind, ast_key, ast_mime, ast_bytes, ast_width, ast_height, ast_status)
       VALUES ($1, 'image', $2, 'image/webp', $3, $4, $5, 'ready')
       RETURNING ${ASSET_COLS}`,
      [userId, key, bytes, width, height],
    );
    return rows[0];
  });
}

export async function usedBytes(userId: number): Promise<number> {
  const { rows } = await pool.query<{ used: string }>(USED_BYTES, [userId]);
  return Number(rows[0].used);
}

/**
 * The stored file of a ready asset when viewer `viewerId` may read it: its owner, or anyone who may read a note that
 * references it, by the same rules as the note itself (blocks, friends-only, hidden, deleted, collaborators; D49, R30).
 */
export async function getReadableAsset(
  id: number,
  viewerId: number,
): Promise<{ key: string; mime: string } | undefined> {
  const { rows } = await pool.query<{ key: string; mime: string }>(
    `SELECT a.ast_key AS "key", a.ast_mime AS "mime" FROM "ASSET_T" a
     WHERE a.ast_id = $2 AND a.ast_status = 'ready'
       AND (a.ast_usr_id = $1 OR EXISTS (
             SELECT 1 FROM "POST_ASSET_T" pa JOIN "POST_T" p ON p.pst_id = pa.pas_pst_id
             WHERE pa.pas_ast_id = a.ast_id AND (${READABLE} OR ${VISIBLE_OR_ADMIN})))`,
    [viewerId, id],
  );
  return rows[0];
}

/** The kind of each given asset that is ready and owned by one of `ownerIds`; others are absent from the map. */
export async function usableAssetKinds(ids: number[], ownerIds: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const { rows } = await pool.query<{ id: number; kind: string }>(
    `SELECT ast_id AS "id", ast_kind AS "kind" FROM "ASSET_T"
     WHERE ast_id = ANY($1::INT[]) AND ast_usr_id = ANY($2::INT[]) AND ast_status = 'ready'`,
    [ids, ownerIds],
  );
  return new Map(rows.map((r) => [r.id, r.kind]));
}

/** Marks old assets that no live note references as deleted and returns their storage keys, for the caller to remove. */
export async function takeUnlinkedAssets(): Promise<string[]> {
  const { rows } = await pool.query<{ key: string }>(
    `UPDATE "ASSET_T" a SET ast_status = 'deleted'
     WHERE a.ast_status IN ('pending', 'ready') AND a.ast_created_at < NOW() - make_interval(hours => $1)
       AND NOT EXISTS (SELECT 1 FROM "POST_ASSET_T" pa JOIN "POST_T" p ON p.pst_id = pa.pas_pst_id
                       WHERE pa.pas_ast_id = a.ast_id AND p.pst_status <> 'deleted')
     RETURNING a.ast_key AS "key"`,
    [ASSETS.unlinkedAgeHours],
  );
  return rows.map((r) => r.key);
}
