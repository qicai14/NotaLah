import { pool } from '../../lib/pool';
import { assertTestDatabase } from './guard';
import { seedUat } from './seed';

// Empties every table except the migrations record and MODULE_T (the migration-seeded CT modules), then reseeds the UAT data, for the E2E suite (#81).
try {
  const { rows: db } = await pool.query<{ name: string }>('SELECT current_database() AS name');
  assertTestDatabase(db[0].name);
  const { rows } = await pool.query<{ t: string }>(
    `SELECT quote_ident(tablename) AS t FROM pg_tables
     WHERE schemaname = 'public' AND tablename NOT IN ('schema_migrations', 'MODULE_T')`,
  );
  if (rows.length) await pool.query(`TRUNCATE ${rows.map((r) => r.t).join(', ')} RESTART IDENTITY CASCADE`);
  const r = await seedUat(pool);
  console.log(`UAT reset on database ${r.db}`, r.inserted);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
