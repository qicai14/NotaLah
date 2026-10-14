import { pool } from '../../lib/pool';

export interface AdminModule {
  id: number;
  code: string;
  name: string;
  programme: string;
  noteCount: number;
}

export async function listProgrammes(): Promise<string[]> {
  const { rows } = await pool.query<{ mod_programme: string }>(
    `SELECT DISTINCT mod_programme FROM "MODULE_T" ORDER BY mod_programme`,
  );
  return rows.map((r) => r.mod_programme);
}

export async function programmeExists(programme: string): Promise<boolean> {
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM "MODULE_T" WHERE mod_programme = $1) AS "ok"`,
    [programme],
  );
  return rows[0].ok;
}

const MODULE_SELECT = `SELECT m.mod_id AS "id", m.mod_code AS "code", m.mod_name AS "name", m.mod_programme AS "programme",
       (SELECT COUNT(*)::INT FROM "POST_T" p WHERE p.pst_mod_id = m.mod_id AND p.pst_status = 'published') AS "noteCount"
FROM "MODULE_T" m`;

export async function listAdminModules(): Promise<AdminModule[]> {
  const { rows } = await pool.query<AdminModule>(`${MODULE_SELECT} ORDER BY m.mod_code`);
  return rows;
}

/** Throws a unique violation when the code exists; the caller maps it to 409. */
export async function createModule(code: string, name: string, programme: string): Promise<AdminModule> {
  const { rows } = await pool.query<AdminModule>(
    `WITH m AS (
       INSERT INTO "MODULE_T" (mod_code, mod_name, mod_programme) VALUES ($1, $2, $3)
       RETURNING mod_id, mod_code, mod_name, mod_programme
     )
     SELECT m.mod_id AS "id", m.mod_code AS "code", m.mod_name AS "name", m.mod_programme AS "programme", 0 AS "noteCount"
     FROM m`,
    [code, name, programme],
  );
  return rows[0];
}

/** Renames a module; omitted fields keep their value. Undefined when the id is unknown. */
export async function updateModule(id: number, p: { name?: string; programme?: string }): Promise<AdminModule | undefined> {
  const { rowCount } = await pool.query(
    `UPDATE "MODULE_T" SET mod_name = COALESCE($2, mod_name), mod_programme = COALESCE($3, mod_programme)
     WHERE mod_id = $1`,
    [id, p.name ?? null, p.programme ?? null],
  );
  if (!rowCount) return undefined;
  const { rows } = await pool.query<AdminModule>(`${MODULE_SELECT} WHERE m.mod_id = $1`, [id]);
  return rows[0];
}
