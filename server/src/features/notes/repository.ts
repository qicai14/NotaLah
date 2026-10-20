import type { Aspect, Fill, SlideElement } from '@notalah/shared';
import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import { fromMicros, type KeysetPage, micros, toPage } from '../../lib/keyset';
import { inTransaction, pool } from '../../lib/pool';
import { LINKABLE_STATUSES } from '../assets/config';
import { approvedLecturer, blockedWith, countingLecturer, friends, userRef, viewerIsAdmin } from '../users/repository';
import { assetRefs, type NoteInput } from './service';

/** The note's module as `{id, code, name}` or NULL (aliases m = MODULE_T, LEFT JOINed). */
export const MODULE_COL = `CASE WHEN m.mod_id IS NULL THEN NULL
       ELSE json_build_object('id', m.mod_id, 'code', m.mod_code, 'name', m.mod_name) END AS "module"`;

/** VISIBLE before blocks: what reporting needs, as a user may still report a note by someone in a block with them (D49). */
export const VISIBLE_IGNORING_BLOCKS = `(p.pst_status <> 'deleted' AND (p.pst_usr_id = $1 OR (p.pst_status = 'published'
    AND EXISTS (SELECT 1 FROM "USER_T" pa WHERE pa.usr_id = p.pst_usr_id AND pa.usr_status IN ('active', 'restricted')) AND
    (p.pst_visibility = 'public' OR ${friends('$1', 'p.pst_usr_id')}))))`;

/** Exported SQL fragment (contract: alias p = POST_T, $1 = viewer id). Who may see a post ($1 = viewer id): the author, or a published post by an active or restricted account (a suspension withdraws the content until reinstated, D26) that is public or, when contacts-only, by a friend of the viewer (mutual follow, D38), and whose author is in no block with the viewer (D49). */
export const VISIBLE = `(${VISIBLE_IGNORING_BLOCKS} AND NOT ${blockedWith('$1', 'p.pst_usr_id')})`;

/** Post p can be reached through collaboration or a share link: a draft or published note by an active or restricted author, never hidden or deleted (R30, D46). */
export const SHAREABLE = `(p.pst_status IN ('draft', 'published')
    AND EXISTS (SELECT 1 FROM "USER_T" pa WHERE pa.usr_id = p.pst_usr_id AND pa.usr_status IN ('active', 'restricted')))`;

/** SQL: the collaborator role ('view' | 'edit') of user $1 on post p, or NULL when there is none, p is not SHAREABLE or a block lies between $1 and the owner (kept, so an unblock restores it, D49). */
const COLLAB_ROLE = `(SELECT c.clb_role FROM "COLLABORATOR_T" c WHERE c.clb_pst_id = p.pst_id AND c.clb_usr_id = $1 AND ${SHAREABLE}
    AND NOT ${blockedWith('$1', 'p.pst_usr_id')})`;

/** SQL (alias c = COLLABORATOR_T): an edit collaborator who has saved the note at least once, so an invitation alone never credits anyone or reaches their followers (D46). */
export const CREDITED_EDITOR = `(c.clb_role = 'edit' AND c.clb_edited_at IS NOT NULL)`;

/** SQL: the viewer's access to post p ($1 = viewer id): 'owner', a collaborator role, or NULL. */
const MY_ROLE = `CASE WHEN p.pst_usr_id = $1 THEN 'owner' ELSE ${COLLAB_ROLE} END`;

/** SQL: viewer $1 may read post p, as anyone it is VISIBLE to or as a collaborator (R30). */
export const READABLE = `(${VISIBLE} OR ${COLLAB_ROLE} IS NOT NULL)`;

/** VISIBLE, or any published post for an admin, so a suspended author's notes stay reviewable on their profile and detail (D47); the feed keeps plain VISIBLE. */
export const VISIBLE_OR_ADMIN = `(${VISIBLE} OR (p.pst_status = 'published' AND ${viewerIsAdmin('$1')}))`;

/** The note's hashtag names, alphabetical (alias p = POST_T). */
export const HASHTAGS_COL = `COALESCE((SELECT json_agg(h.hsh_name ORDER BY h.hsh_name)
                   FROM "POST_HASHTAG_T" ph JOIN "HASHTAG_T" h ON h.hsh_id = ph.phs_hsh_id
                   WHERE ph.phs_pst_id = p.pst_id), '[]'::JSON) AS "hashtags"`;

/** The note's ready uploads as asset id -> file URL (alias p = POST_T). */
const ASSETS_COL = `COALESCE((SELECT json_object_agg(a.ast_id::TEXT, '/api/assets/' || a.ast_id || '/file')
                   FROM "POST_ASSET_T" pa JOIN "ASSET_T" a ON a.ast_id = pa.pas_ast_id
                   WHERE pa.pas_pst_id = p.pst_id AND a.ast_status = 'ready'), '{}'::JSON) AS "assets"`;

/** Every video the note references as asset id -> 'processing', 'ready' or 'failed', so a player can say why there is no file yet (R40). */
const VIDEO_STATUS_COL = `COALESCE((SELECT json_object_agg(a.ast_id::TEXT, a.ast_status)
                   FROM "POST_ASSET_T" pa JOIN "ASSET_T" a ON a.ast_id = pa.pas_ast_id
                   WHERE pa.pas_pst_id = p.pst_id AND a.ast_kind = 'video'
                     AND a.ast_status IN ${LINKABLE_STATUSES}), '{}'::JSON) AS "videoStatus"`;

export interface Note {
  id: number;
  title: string;
  theme: string;
  aspect: Aspect;
  music: { trackId: number; title: string | null; artist: string | null; cover: string | null; volume: number } | null;
  assets: Record<string, string>;
  videoStatus: Record<string, 'processing' | 'ready' | 'failed'>;
  status: string;
  visibility: string | null;
  module: { id: number; code: string; name: string } | null;
  hashtags: string[];
  /** `notes` (private page notes) is only filled for the author and edit collaborators, by getVisibleNote. */
  /** The slides in `slides` may be only the first few (feed cards); this is the note's full count. */
  slideCount: number;
  slides: { position: number; background: Fill; elements: SlideElement[]; notes?: string }[];
  author: { id: number; displayName: string; role: string; isVerifiedLecturer: boolean };
  coauthors: { id: number; displayName: string }[];
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

/**
 * Note columns (contract: alias p = POST_T; use with NOTE_FROM).
 */
export const noteCols = (
  slideLimit?: number,
) => `p.pst_id AS "id", p.pst_title AS "title", p.pst_template AS "theme", p.pst_aspect AS "aspect", p.pst_status AS "status",
         CASE WHEN p.pst_music_track_id IS NULL THEN NULL
              ELSE json_build_object('trackId', p.pst_music_track_id, 'title', p.pst_music_title,
                                     'artist', p.pst_music_artist, 'cover', p.pst_music_cover,
                                     'volume', p.pst_music_volume) END AS "music",
         ${ASSETS_COL},
         ${VIDEO_STATUS_COL},
         p.pst_visibility AS "visibility",
         ${MODULE_COL},
         ${HASHTAGS_COL},
         COALESCE((SELECT json_agg(json_build_object('position', s.sld_position, 'background', s.sld_doc -> 'background',
                                                     'elements', s.sld_doc -> 'elements')
                                   ORDER BY s.sld_position)
                   FROM "SLIDE_T" s WHERE s.sld_pst_id = p.pst_id${slideLimit ? ` AND s.sld_position <= ${Math.trunc(slideLimit)}` : ''}), '[]'::JSON) AS "slides",
         (SELECT COUNT(*)::INT FROM "SLIDE_T" WHERE sld_pst_id = p.pst_id) AS "slideCount",
         json_build_object('id', u.usr_id, 'displayName', u.usr_display_name, 'role', u.usr_role,
                           'isVerifiedLecturer', ${approvedLecturer('u')}) AS "author",
         COALESCE((SELECT json_agg(${userRef('cu')} ORDER BY c.clb_edited_at, cu.usr_id)
                   FROM "COLLABORATOR_T" c JOIN "USER_T" cu ON cu.usr_id = c.clb_usr_id
                   WHERE c.clb_pst_id = p.pst_id AND ${CREDITED_EDITOR} AND cu.usr_status IN ('active', 'restricted')),
                  '[]'::JSON) AS "coauthors",
         p.pst_created_at AS "createdAt", p.pst_updated_at AS "updatedAt", p.pst_published_at AS "publishedAt"`;

export const NOTE_COLS = noteCols();

/** FROM clause defining the aliases p, u and m that NOTE_COLS uses. */
export const NOTE_FROM = `
  FROM "POST_T" p
  JOIN "USER_T" u ON u.usr_id = p.pst_usr_id
  LEFT JOIN "MODULE_T" m ON m.mod_id = p.pst_mod_id`;

/** Super Likes that count (alias v): by an approved lecturer whose account is active or restricted (D24), made at or after the note's last content edit (R30, D46). Ends in a WHERE clause, so callers append AND conditions. */
export const VALID_VERIFICATIONS = `FROM "VERIFICATION_T" v JOIN "USER_T" vu ON vu.usr_id = v.ver_usr_id
     JOIN "POST_T" vp ON vp.pst_id = v.ver_pst_id
     WHERE ${countingLecturer('vu')} AND (vp.pst_content_edited_at IS NULL OR v.ver_created_at >= vp.pst_content_edited_at)`;

/** A counting lecturer's Super Like on note p predates its last content edit, so it stops counting until re-confirmed (R30). */
const EDITED_SINCE_VERIFICATION = `EXISTS (SELECT 1 FROM "VERIFICATION_T" v JOIN "USER_T" vu ON vu.usr_id = v.ver_usr_id
     WHERE v.ver_pst_id = p.pst_id AND ${countingLecturer('vu')} AND v.ver_created_at < p.pst_content_edited_at)`;

export const VERIFIED = `EXISTS (SELECT 1 ${VALID_VERIFICATIONS} AND v.ver_pst_id = p.pst_id)`;

/** Display name of the earliest valid verifier of note p, or NULL (FR2 "Verified by"). */
export const VERIFIED_BY = `(SELECT vu.usr_display_name ${VALID_VERIFICATIONS} AND v.ver_pst_id = p.pst_id ORDER BY v.ver_created_at, v.ver_id LIMIT 1)`;

/** Likes by the author or an edit collaborator of note p (alias l = LIKE_T), which never raise E (D47). */
const OWN_LIKE = `(l.lik_usr_id = p.pst_usr_id OR EXISTS (SELECT 1 FROM "COLLABORATOR_T" c
                  WHERE c.clb_pst_id = p.pst_id AND c.clb_usr_id = l.lik_usr_id AND c.clb_role = 'edit'))`;

/**
 * Like and comment counts of note p (the author's own comments are not counted, D22). With `asOf` (an SQL expression)
 * these are the ranking inputs (D24): only rows created by then, and no likes by the author or an edit collaborator (D47).
 * Without it they are the shown counts, which leave out comments by suspended authors as readers do not see them (D47).
 */
export const countsCol = (asOf?: string) => `json_build_object(
              'likes', (SELECT COUNT(*)::INT FROM "LIKE_T" l WHERE l.lik_pst_id = p.pst_id${asOf ? ` AND l.lik_created_at <= ${asOf} AND NOT ${OWN_LIKE}` : ''}),
              'comments', (SELECT COUNT(*)::INT FROM "COMMENT_T" WHERE cmt_pst_id = p.pst_id AND NOT cmt_is_deleted
                           AND cmt_usr_id <> p.pst_usr_id${
                             asOf
                               ? ` AND cmt_created_at <= ${asOf}`
                               : ` AND NOT EXISTS (SELECT 1 FROM "USER_T" cu WHERE cu.usr_id = cmt_usr_id AND cu.usr_status = 'suspended')`
                           })) AS "counts"`;

/** Engagement columns (alias p; $1 = viewer id; the author's own comments are not counted, D22; `verified`/`verifiedBy` per VERIFIED, `verifiedByMe` = the viewer's own Super Like) shared by the feed and the note detail so the counts exist once. */
export const ENGAGEMENT_COLS = `${countsCol()},
            EXISTS (SELECT 1 FROM "LIKE_T" WHERE lik_pst_id = p.pst_id AND lik_usr_id = $1) AS "liked",
            EXISTS (SELECT 1 FROM "BOOKMARK_T" WHERE bmk_pst_id = p.pst_id AND bmk_usr_id = $1) AS "bookmarked",
            ${VERIFIED} AS "verified", ${VERIFIED_BY} AS "verifiedBy", ${EDITED_SINCE_VERIFICATION} AS "editedSinceVerification",
            EXISTS (SELECT 1 FROM "VERIFICATION_T" WHERE ver_pst_id = p.pst_id AND ver_usr_id = $1) AS "verifiedByMe"`;

export interface NoteWithEngagement extends Note {
  counts: { likes: number; comments: number };
  liked: boolean;
  bookmarked: boolean;
  verified: boolean;
  verifiedBy: string | null;
  editedSinceVerification: boolean;
  verifiedByMe: boolean;
}

/**
 * The note as the API returns it, or undefined when it does not exist or the viewer may not read it. `viaLink` is for a
 * caller that already resolved a share link to this note: any SHAREABLE note is then returned (R30).
 */
export async function getVisibleNote(
  id: number,
  viewerId: number,
  viaLink = false,
): Promise<(NoteWithEngagement & { myRole: NoteRole | null }) | undefined> {
  // Page notes are private (NOTE-TC36). Edit collaborators get them too, or their full-replace save would wipe them.
  // They come in the same SELECT as the slides, so a concurrent save cannot leave the two out of step.
  const { rows } = await pool.query<NoteWithEngagement & { myRole: NoteRole | null; pageNotes: string[] | null }>(
    `SELECT ${NOTE_COLS}, ${ENGAGEMENT_COLS}, ${MY_ROLE} AS "myRole",
            CASE WHEN ${MY_ROLE} IN ('owner', 'edit')
                 THEN (SELECT json_agg(sld_notes ORDER BY sld_position) FROM "SLIDE_T" WHERE sld_pst_id = p.pst_id) END AS "pageNotes"
            ${NOTE_FROM} WHERE p.pst_id = $2 AND ${viaLink ? SHAREABLE : `(${READABLE} OR ${VISIBLE_OR_ADMIN})`}`,
    [viewerId, id],
  );
  if (!rows[0]) return undefined;
  const { pageNotes, ...note } = rows[0];
  pageNotes?.forEach((notes, i) => (note.slides[i].notes = notes));
  return note;
}

export interface DraftSummary {
  id: number;
  title: string;
  module: { id: number; code: string; name: string } | null;
  hashtags: string[];
  updatedAt: Date;
  aspect: Aspect;
  slideCount: number;
  /** The first slide without its page notes, for the thumbnail (as on profile notes). */
  cover: { background: Fill; elements: SlideElement[] } | null;
  assets: Record<string, string>;
  videoStatus: Note['videoStatus'];
}

/** One page of the author's drafts, last edited first; keyset on (updated_at, id), D40. */
export async function listDrafts(
  authorId: number,
  { cursor, limit }: KeysetPage,
): Promise<{ items: DraftSummary[]; nextCursor: string | null }> {
  const { rows } = await pool.query<DraftSummary & { cursor: string }>(
    `SELECT p.pst_id AS "id", p.pst_title AS "title",
            ${MODULE_COL},
            ${HASHTAGS_COL},
            p.pst_updated_at AS "updatedAt", p.pst_aspect AS "aspect",
            (SELECT COUNT(*)::INT FROM "SLIDE_T" s WHERE s.sld_pst_id = p.pst_id) AS "slideCount",
            (SELECT json_build_object('background', s.sld_doc -> 'background', 'elements', s.sld_doc -> 'elements')
             FROM "SLIDE_T" s WHERE s.sld_pst_id = p.pst_id ORDER BY s.sld_position LIMIT 1) AS "cover",
            ${ASSETS_COL},
            ${VIDEO_STATUS_COL},
            ${micros('p.pst_updated_at')} || '_' || p.pst_id AS "cursor"
     FROM "POST_T" p LEFT JOIN "MODULE_T" m ON m.mod_id = p.pst_mod_id
     WHERE p.pst_usr_id = $1 AND p.pst_status = 'draft'
       AND ($2::BIGINT IS NULL OR (p.pst_updated_at, p.pst_id) < (${fromMicros('$2')}, $3::INT))
     ORDER BY p.pst_updated_at DESC, p.pst_id DESC
     LIMIT $4`,
    [authorId, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
  );
  return toPage(rows, limit);
}

export type NoteRole = 'owner' | 'edit' | 'view';

/** 403 message when a co-author tries to edit, lock or join while the author's account is not active (UC21). */
export const NOT_EDITABLE = 'This note cannot be edited while its author is restricted';

export interface NoteMeta {
  authorId: number;
  /** The author's account is active: co-authors may only edit, lock or join then (UC21, D46). */
  authorActive: boolean;
  status: string;
  visibility: 'public' | 'contacts' | null;
  moduleId: number | null;
  /** The viewer's access: the owner, a collaborator role, or null. */
  role: NoteRole | null;
  /** The viewer may read the note: VISIBLE or a collaborator. */
  visible: boolean;
}

/** Ownership, status and the viewer's access to a note; undefined if it does not exist or is deleted. */
export async function getNoteMeta(id: number, viewerId: number): Promise<NoteMeta | undefined> {
  const { rows } = await pool.query<NoteMeta>(
    `SELECT p.pst_usr_id AS "authorId", p.pst_status AS "status", p.pst_visibility AS "visibility", p.pst_mod_id AS "moduleId",
            ${MY_ROLE} AS "role", ${READABLE} AS "visible",
            EXISTS (SELECT 1 FROM "USER_T" a WHERE a.usr_id = p.pst_usr_id AND a.usr_status = 'active') AS "authorActive"
     FROM "POST_T" p WHERE p.pst_id = $2 AND p.pst_status <> 'deleted'`,
    [viewerId, id],
  );
  return rows[0];
}

/** The slide as stored in sld_doc: the page notes live in their own column. */
const slideDoc = ({ background, elements }: NoteInput['slides'][number]) => ({ background, elements });

async function writeChildren(client: PoolClient, postId: number, n: NoteInput): Promise<void> {
  const tags = [...n.hashtags].sort(); // fixed order avoids deadlocks between concurrent upserts
  await client.query(`DELETE FROM "SLIDE_T" WHERE sld_pst_id = $1`, [postId]);
  await client.query(`DELETE FROM "POST_HASHTAG_T" WHERE phs_pst_id = $1`, [postId]);
  await client.query(`DELETE FROM "POST_ASSET_T" WHERE pas_pst_id = $1`, [postId]);
  const assetIds = [...new Set(assetRefs(n.slides).map((r) => r.id))].sort((a, b) => a - b);
  if (assetIds.length > 0) {
    // FOR SHARE locks the asset rows, so a purge in flight skips them (SKIP LOCKED) and one already committed shows as a short count.
    const { rowCount } = await client.query(
      `INSERT INTO "POST_ASSET_T" (pas_pst_id, pas_ast_id)
       SELECT $1, ast_id FROM "ASSET_T" WHERE ast_id = ANY($2::INT[]) AND ast_status IN ${LINKABLE_STATUSES} FOR SHARE`,
      [postId, assetIds],
    );
    if (rowCount !== assetIds.length) throw Object.assign(new Error('Image not found'), { status: 400 });
  }
  if (n.slides.length > 0) {
    await client.query(
      `INSERT INTO "SLIDE_T" (sld_pst_id, sld_position, sld_doc, sld_notes)
       SELECT $1, t.ord, t.doc::JSONB, t.notes
       FROM unnest($2::TEXT[], $3::TEXT[]) WITH ORDINALITY AS t(doc, notes, ord)`,
      [postId, n.slides.map(slideDoc).map((d) => JSON.stringify(d)), n.slides.map((s) => s.notes)],
    );
  }
  if (tags.length > 0) {
    await client.query(
      `INSERT INTO "HASHTAG_T" (hsh_name) SELECT unnest($1::TEXT[]) ON CONFLICT (hsh_name) DO NOTHING`,
      [tags],
    );
    await client.query(
      `INSERT INTO "POST_HASHTAG_T" (phs_pst_id, phs_hsh_id)
       SELECT $1, hsh_id FROM "HASHTAG_T" WHERE hsh_name = ANY($2::TEXT[])`,
      [postId, tags],
    );
  }
  // Search document is rebuilt in SQL from title, the text, code, table and image alt text of every element, and hashtags
  // (D20, R21 spec 2.6). Page notes are never indexed.
  await client.query(
    `UPDATE "POST_T" p
     SET pst_search_doc = to_tsvector('english',
           p.pst_title || ' '
           || COALESCE((SELECT string_agg(CASE e ->> 'type'
                                            WHEN 'text' THEN regexp_replace(e ->> 'html', '<[^>]*>', ' ', 'g')
                                            WHEN 'code' THEN e ->> 'code'
                                            WHEN 'table' THEN (SELECT string_agg(c, ' ') FROM jsonb_array_elements(e -> 'cells') r,
                                                                    jsonb_array_elements_text(r) c)
                                            ELSE e ->> 'alt' END, ' ' ORDER BY s.sld_position, ord)
                        FROM "SLIDE_T" s, jsonb_array_elements(s.sld_doc -> 'elements') WITH ORDINALITY AS t(e, ord)
                        WHERE s.sld_pst_id = p.pst_id AND e ->> 'type' IN ('text', 'code', 'table', 'image')), '') || ' '
           || COALESCE((SELECT string_agg(h.hsh_name, ' ')
                        FROM "POST_HASHTAG_T" ph JOIN "HASHTAG_T" h ON h.hsh_id = ph.phs_hsh_id
                        WHERE ph.phs_pst_id = p.pst_id), '')),
         pst_updated_at = NOW()
     WHERE p.pst_id = $1`,
    [postId],
  );
}

/** pst_music_provider, track id and volume. shortcut: title, artist and cover stay NULL until R9's Deezer proxy fills them. */
const musicParams = (n: NoteInput) => [n.music?.provider ?? null, n.music?.trackId ?? null, n.music?.volume ?? null];

export function createNote(authorId: number, n: NoteInput): Promise<number> {
  return inTransaction(async (c) => {
    const { rows } = await c.query<{ pst_id: number }>(
      `INSERT INTO "POST_T" (pst_usr_id, pst_mod_id, pst_title, pst_template, pst_aspect, pst_status, pst_visibility,
                             pst_music_provider, pst_music_track_id, pst_music_volume, pst_published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $6::VARCHAR = 'published' THEN NOW() END)
       RETURNING pst_id`,
      [authorId, n.moduleId, n.title, n.theme, n.aspect, n.status, n.visibility, ...musicParams(n)],
    );
    await writeChildren(c, rows[0].pst_id, n);
    return rows[0].pst_id;
  });
}

type ReplaceResult = 'ok' | 'gone' | 'forbidden' | 'locked' | 'stale';

/**
 * Replaces the note as `editorId` (the owner or an edit collaborator). Refuses with 'locked' while another user holds a
 * live soft lock, with 'stale' when `baseUpdatedAt` is given and differs from pst_updated_at, and with 'forbidden' when the
 * editor lost edit access since the route checked it (R30). A co-author's first save starts their credit (clb_edited_at, D46). An edit never moves
 * pst_published_at; a title or slide change to a published note stamps pst_content_edited_at, which voids older Super Likes.
 */
export function replaceNote(
  id: number,
  n: NoteInput,
  editorId: number,
  baseUpdatedAt: Date | null,
): Promise<ReplaceResult> {
  return inTransaction(async (c) => {
    const { rows } = await c.query<{
      status: string;
      title: string;
      aspect: string;
      updatedAt: Date;
      role: NoteRole | null;
      lockedByOther: boolean;
      slides: unknown[];
    }>(
      `SELECT p.pst_status AS "status", p.pst_title AS "title", p.pst_aspect AS "aspect", p.pst_updated_at AS "updatedAt", ${MY_ROLE} AS "role",
              COALESCE(p.pst_lock_usr_id <> $1 AND p.pst_lock_expires_at > NOW(), FALSE) AS "lockedByOther",
              COALESCE((SELECT json_agg(sld_doc ORDER BY sld_position) FROM "SLIDE_T" WHERE sld_pst_id = p.pst_id), '[]'::JSON) AS "slides"
       FROM "POST_T" p WHERE p.pst_id = $2 AND p.pst_status IN ('draft', 'published')
       FOR UPDATE OF p`,
      [editorId, id],
    );
    const cur = rows[0];
    if (!cur) return 'gone'; // deleted or hidden since the permission check
    if (cur.role !== 'owner' && cur.role !== 'edit') return 'forbidden';
    if (cur.lockedByOther) return 'locked';
    // Both sides are millisecond Dates: the client was sent pst_updated_at through the same pg parser.
    if (baseUpdatedAt && cur.updatedAt.getTime() !== baseUpdatedAt.getTime()) return 'stale';
    const contentEdited =
      cur.status === 'published' &&
      (cur.title !== n.title || cur.aspect !== n.aspect || !isDeepStrictEqual(cur.slides, n.slides.map(slideDoc)));
    await c.query(
      `UPDATE "POST_T"
       SET pst_mod_id = $2, pst_title = $3, pst_template = $4, pst_aspect = $5, pst_status = $6, pst_visibility = $7,
           pst_music_provider = $8, pst_music_track_id = $9, pst_music_volume = $10, pst_music_title = NULL,
           pst_music_artist = NULL, pst_music_cover = NULL,
           pst_published_at = CASE WHEN $6::VARCHAR = 'published' THEN COALESCE(pst_published_at, NOW()) ELSE pst_published_at END,
           pst_content_edited_at = CASE WHEN $11 THEN NOW() ELSE pst_content_edited_at END
       WHERE pst_id = $1`,
      [id, n.moduleId, n.title, n.theme, n.aspect, n.status, n.visibility, ...musicParams(n), contentEdited],
    );
    await writeChildren(c, id, n);
    if (cur.role === 'edit') {
      await c.query(
        `UPDATE "COLLABORATOR_T" SET clb_edited_at = COALESCE(clb_edited_at, NOW()) WHERE clb_pst_id = $1 AND clb_usr_id = $2`,
        [id, editorId],
      );
    }
    return 'ok';
  });
}

/**
 * Publishes the owner's draft, ignoring a co-author's edit lock because the text is untouched (D58): one conditional
 * UPDATE of status, visibility and publish time, then the blank slides at `blankPositions` are removed and the rest
 * renumbered, as a save of a published note does. False when the note is no longer that owner's draft or was saved
 * since `baseUpdatedAt` (pst_updated_at is compared at millisecond precision, like the Date the client read).
 */
export function publishNote(
  id: number,
  ownerId: number,
  visibility: 'public' | 'contacts',
  baseUpdatedAt: Date,
  blankPositions: number[],
): Promise<boolean> {
  return inTransaction(async (c) => {
    const { rowCount } = await c.query(
      `UPDATE "POST_T"
       SET pst_status = 'published', pst_visibility = $3, pst_published_at = NOW(), pst_updated_at = NOW()
       WHERE pst_id = $1 AND pst_usr_id = $2 AND pst_status = 'draft'
         AND date_trunc('milliseconds', pst_updated_at) = $4`,
      [id, ownerId, visibility, baseUpdatedAt],
    );
    if (rowCount !== 1) return false;
    if (blankPositions.length > 0) {
      await c.query(`DELETE FROM "SLIDE_T" WHERE sld_pst_id = $1 AND sld_position = ANY($2::INT[])`, [
        id,
        blankPositions,
      ]);
      // Shifted out of range first: UNIQUE (sld_pst_id, sld_position) is checked row by row.
      await c.query(`UPDATE "SLIDE_T" SET sld_position = sld_position + 1000 WHERE sld_pst_id = $1`, [id]);
      await c.query(
        `UPDATE "SLIDE_T" s SET sld_position = r.n
         FROM (SELECT sld_id, ROW_NUMBER() OVER (ORDER BY sld_position)::INT AS n FROM "SLIDE_T" WHERE sld_pst_id = $1) r
         WHERE s.sld_id = r.sld_id`,
        [id],
      );
    }
    return true;
  });
}

export async function softDeleteNote(id: number): Promise<void> {
  await pool.query(
    `UPDATE "POST_T" SET pst_status = 'deleted', pst_updated_at = NOW() WHERE pst_id = $1 AND pst_status <> 'deleted'`,
    [id],
  );
}

export interface NoteSummary {
  id: number;
  title: string;
  moduleCode: string | null;
  publishedAt: Date | null;
  hashtags: string[];
  verifiedBy: string | null;
}

/** Columns of a note summary (needs the POST_T alias p and MODULE_T alias m); verifiedBy is null when unverified. */
export const SUMMARY_COLS = `p.pst_id AS "id", p.pst_title AS "title", m.mod_code AS "moduleCode", p.pst_published_at AS "publishedAt",
            ${HASHTAGS_COL}, ${VERIFIED_BY} AS "verifiedBy"`;

/** A profile tile: the summary plus what is needed to draw the first slide as a thumbnail and show the likes. */
export interface ProfileNote extends NoteSummary {
  aspect: Aspect;
  likes: number;
  cover: { background: Fill; elements: SlideElement[] } | null;
  assets: Record<string, string>;
  videoStatus: Note['videoStatus'];
}

/** One page of an author's published notes that the viewer may see, newest first; keyset on (published_at, id), D40. */
export async function listNotesByAuthor(
  authorId: number,
  viewerId: number,
  { cursor, limit }: KeysetPage,
): Promise<{ items: ProfileNote[]; nextCursor: string | null }> {
  const { rows } = await pool.query<ProfileNote & { cursor: string }>(
    `SELECT ${SUMMARY_COLS}, p.pst_aspect AS "aspect",
            (SELECT COUNT(*)::INT FROM "LIKE_T" l WHERE l.lik_pst_id = p.pst_id) AS "likes",
            (SELECT json_build_object('background', s.sld_doc -> 'background', 'elements', s.sld_doc -> 'elements')
             FROM "SLIDE_T" s WHERE s.sld_pst_id = p.pst_id ORDER BY s.sld_position LIMIT 1) AS "cover",
            ${ASSETS_COL},
            ${VIDEO_STATUS_COL},
            ${micros('p.pst_published_at')} || '_' || p.pst_id AS "cursor"
     FROM "POST_T" p LEFT JOIN "MODULE_T" m ON m.mod_id = p.pst_mod_id
     WHERE p.pst_usr_id = $2 AND p.pst_status = 'published' AND ${VISIBLE_OR_ADMIN}
       AND ($3::BIGINT IS NULL OR (p.pst_published_at, p.pst_id) < (${fromMicros('$3')}, $4::INT))
     ORDER BY p.pst_published_at DESC, p.pst_id DESC
     LIMIT $5`,
    [viewerId, authorId, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
  );
  return toPage(rows, limit);
}

/** Likes on the author's published notes that the viewer can see, not counting the author's own; for the profile header. */
export async function countLikesReceived(authorId: number, viewerId: number): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::INT AS n FROM "LIKE_T" l JOIN "POST_T" p ON p.pst_id = l.lik_pst_id
     WHERE p.pst_usr_id = $2 AND p.pst_status = 'published' AND ${VISIBLE_OR_ADMIN} AND l.lik_usr_id <> p.pst_usr_id`,
    [viewerId, authorId],
  );
  return rows[0].n;
}

export async function countDrafts(authorId: number): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM "POST_T" WHERE pst_usr_id = $1 AND pst_status = 'draft'`,
    [authorId],
  );
  return Number(rows[0].n);
}
