/** Test credential for the seeded load accounts; only meaningful in a notalah_test_* database. */
export const LOAD_PASSWORD = 'LoadTest#2026';
export const loadEmail = (n: number) => `load${n}@mail.apu.edu.my`;

/** Words the seed builds titles, slide text and hashtags from; the runner searches for the same words. */
export const WORDS =
  `database normalisation transaction deadlock kernel thread process scheduler memory paging cache network
routing subnet protocol packet security encryption hashing algorithm sorting graph tree heap stack queue recursion
complexity requirement stakeholder agile scrum sprint testing integration react component state server client socket
latency throughput compiler parser grammar lexer neural learning model dataset regression cluster project management risk
budget schedule ethics privacy cloud container virtual machine storage backup recovery index query join normal form
design pattern interface class object inheritance polymorphism api rest json http tcp dns firewall`.split(/\s+/);

const fromEnv = (name: string, fallback: number) => Number(process.env[name] ?? fallback);

/** Size of the seeded data: the seed builds it and the runner picks ids from it (LOAD_USERS, LOAD_NOTES, LOAD_DAYS override). */
export const SEED = {
  users: fromEnv('LOAD_USERS', 300),
  notes: fromEnv('LOAD_NOTES', 2000),
  days: fromEnv('LOAD_DAYS', 60),
  lecturers: 20,
  /** Modules the seed adds (LD001-3-2 and on) to the 12 that migration 20261013000002 inserts. */
  extraModules: 18,
  modules: 12 + 18,
} as const;
