/** Throws unless the database is notalah_test or notalah_test_<suffix>; the UAT reset empties every table. */
export function assertTestDatabase(name: string) {
  if (!/^notalah_test(_\w+)?$/.test(name))
    throw new Error(`Refusing to reset "${name}": only notalah_test or notalah_test_*`);
}
