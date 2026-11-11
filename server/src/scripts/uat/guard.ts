/**
 * Throws unless the database is notalah_test or notalah_test_<suffix>; the UAT reset empties every table.
 * `allow` is an explicit opt-in (UAT_RESET_DATABASE) that must equal the exact database name, e.g. a local dev "notalah".
 */
export function assertTestDatabase(name: string, allow = process.env.UAT_RESET_DATABASE) {
  if (/^notalah_test(_\w+)?$/.test(name)) return;
  if (allow === name && process.env.NODE_ENV !== 'production') return;
  throw new Error(
    `Refusing to reset "${name}": only notalah_test or notalah_test_* (or set UAT_RESET_DATABASE=${name} outside production)`,
  );
}
