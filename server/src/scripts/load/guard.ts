export const LOAD_DB_PREFIX = 'notalah_test_';

/** The seed truncates every table, so it only ever runs against a database named notalah_test_*, never the dev or live one. */
export function assertLoadDatabase(name: string): void {
  if (!name.startsWith(LOAD_DB_PREFIX)) {
    throw new Error(`load seed refused: database "${name}" does not start with ${LOAD_DB_PREFIX}`);
  }
}
