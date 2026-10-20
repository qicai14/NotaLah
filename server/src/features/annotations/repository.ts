import { isUniqueViolation, pool } from '../../lib/pool';
import { approvedLecturer, blockedWith, SHOWN_USER } from '../users/repository';

/** Live annotations one note can hold; the list is never paged, so this also bounds a response. */
export const ANNOTATION_LIMIT = 500;

export interface Annotation {
  id: number;
  slideId: number;
  elementId: string;
  quote: string;
  offset: number;
  body: string;
  createdAt: Date;
  author: { id: number; displayName: string; avatarUrl: string | null; isVerifiedLecturer: boolean };
  /** The viewer is the annotator or the note's author. */
  canDelete: boolean;
}

/** Live annotations, oldest first, minus those by a deleted or (for non-admins) suspended author or someone in a block with the viewer, as comments are (D47, D49). */
export async function listAnnotations(noteId: number, viewerId: number, onlyId?: number): Promise<Annotation[]> {
  const { rows } = await pool.query<Annotation>(
    `SELECT a.ant_id AS "id", a.ant_slide_id AS "slideId", a.ant_element_id AS "elementId", a.ant_quote AS "quote",
            a.ant_offset AS "offset", a.ant_body AS "body", a.ant_created_at AS "createdAt",
            json_build_object('id', u.usr_id, 'displayName', u.usr_display_name, 'avatarUrl', u.usr_avatar_url,
                              'isVerifiedLecturer', ${approvedLecturer('u')}) AS "author",
            (a.ant_usr_id = $1 OR p.pst_usr_id = $1) AS "canDelete"
     FROM "ANNOTATION_T" a JOIN "POST_T" p ON p.pst_id = a.ant_pst_id JOIN "USER_T" u ON u.usr_id = a.ant_usr_id
     WHERE a.ant_pst_id = $2 AND a.ant_deleted_at IS NULL AND a.ant_hidden_at IS NULL
       AND ${SHOWN_USER} AND ($3::INT IS NULL OR a.ant_id = $3)
       AND NOT ${blockedWith('$1', 'u.usr_id')}
     ORDER BY a.ant_created_at, a.ant_id
     LIMIT ${ANNOTATION_LIMIT}`,
    [viewerId, noteId, onlyId ?? null],
  );
  return rows;
}

/** The element's type when slide `slideId` (position) of the note's current deck holds `elementId`, else undefined. */
export async function elementType(noteId: number, slideId: number, elementId: string): Promise<string | undefined> {
  const { rows } = await pool.query<{ type: string }>(
    `SELECT e ->> 'type' AS "type" FROM "SLIDE_T" s, jsonb_array_elements(s.sld_doc -> 'elements') e
     WHERE s.sld_pst_id = $1 AND s.sld_position = $2 AND e ->> 'id' = $3`,
    [noteId, slideId, elementId],
  );
  return rows[0]?.type;
}

export interface NewAnnotation {
  slideId: number;
  elementId: string;
  quote: string;
  offset: number;
  body: string;
}

/** Annotations on the note that are neither deleted nor hidden, whoever wrote them. */
export async function countLive(noteId: number): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::INT AS n FROM "ANNOTATION_T" WHERE ant_pst_id = $1 AND ant_deleted_at IS NULL AND ant_hidden_at IS NULL`,
    [noteId],
  );
  return rows[0].n;
}

export async function addAnnotation(noteId: number, userId: number, a: NewAnnotation): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO "ANNOTATION_T" (ant_pst_id, ant_usr_id, ant_slide_id, ant_element_id, ant_quote, ant_offset, ant_body)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ant_id AS "id"`,
    [noteId, userId, a.slideId, a.elementId, a.quote, a.offset, a.body],
  );
  return rows[0].id;
}

/** One annotation as its viewer sees it (the POST response); undefined if it is not listed for them. */
export async function getAnnotation(id: number, noteId: number, viewerId: number): Promise<Annotation | undefined> {
  return (await listAnnotations(noteId, viewerId, id))[0];
}

interface Found {
  annotatorId: number;
  noteAuthorId: number;
}

/** A live, unhidden annotation on the note with its annotator and the note's author, whether or not the viewer can see the note. */
export async function findAnnotation(id: number, noteId: number): Promise<Found | undefined> {
  const { rows } = await pool.query<Found>(
    `SELECT a.ant_usr_id AS "annotatorId", p.pst_usr_id AS "noteAuthorId"
     FROM "ANNOTATION_T" a JOIN "POST_T" p ON p.pst_id = a.ant_pst_id
     WHERE a.ant_id = $1 AND a.ant_pst_id = $2 AND p.pst_status <> 'deleted'
       AND a.ant_deleted_at IS NULL AND a.ant_hidden_at IS NULL`,
    [id, noteId],
  );
  return rows[0];
}

export async function softDelete(id: number): Promise<void> {
  await pool.query(`UPDATE "ANNOTATION_T" SET ant_deleted_at = NOW() WHERE ant_id = $1 AND ant_deleted_at IS NULL`, [
    id,
  ]);
}

export async function setAnnotationsOn(noteId: number, on: boolean): Promise<void> {
  await pool.query(`UPDATE "POST_T" SET pst_annotations_on = $2 WHERE pst_id = $1`, [noteId, on]);
}

/** Returns false when the user already has an open report on the annotation (partial unique index, SQLSTATE 23505). */
export async function addReport(
  noteId: number,
  annotationId: number,
  reporterId: number,
  reason: string,
  details: string | null,
): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO "REPORT_T" (rpt_pst_id, rpt_ant_id, rpt_reporter_id, rpt_reason, rpt_details) VALUES ($1, $2, $3, $4, $5)`,
      [noteId, annotationId, reporterId, reason, details],
    );
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}
