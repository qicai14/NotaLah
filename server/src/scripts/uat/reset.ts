import { pool } from '../../lib/pool';
import { seedUat } from './seed';

// Empties every table (keeping the migrations record) and reseeds the UAT data, for the E2E suite (#81).
try {
  const { rows: db } = await pool.query<{ name: string }>('SELECT current_database() AS name');
  if (!db[0].name.includes('test')) throw new Error(`Refusing to reset "${db[0].name}": only databases named *test*`);
  const { rows } = await pool.query<{ t: string }>(
    `SELECT quote_ident(tablename) AS t FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`,
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
