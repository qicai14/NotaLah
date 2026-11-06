# Testing

- Every test is named with its TC ID from [`../chapter4/4.5_test_cases.md`](../chapter4/4.5_test_cases.md), and every
  new test gets a row there. IDs are unique across the repo: check the highest number for the prefix before adding.
- Server: `server/tests/<feature>/` against the real `notalah_test` database; run `vp run server#test` (a bare
  `vp test` from the repo root skips the server test config).
- Client: `*.test.ts(x)` beside the code; render tests start with `// @vitest-environment jsdom`; run `vp run client#test`.
- Browser checks: `agent-browser` for exploration; Playwright Test for the E2E smoke suite (skill
  `playwright-best-practices`).
- E2E: `vp run test:e2e` needs `vp run db:up` and a `notalah_test_81` database (`docker compose exec db psql -U notalah -c
  'create database notalah_test_81'`, once; set `E2E_DATABASE_URL` to use another). Its globalSetup migrates that
  database and runs `server#uat:reset` (empties every table except `schema_migrations` and `MODULE_T`, reseeds the UAT data; refuses unless `current_database()` matches `/^notalah_test(_w+)?$/`),
  and the dev server and AI stub are started against it, so every run starts fresh. Ports 5173 and 4000 must be free.
  Specs run in file order with one worker; the A2 spec is named `zz-` because it suspends student1. Axe fails on serious
  and critical violations; an entry in `e2e/helpers/axe.ts` needs a reason. Screenshots and timings land in `test-results/` (ignored); set `E2E_WRITE_DOCS=1` to write the tracked copies to `docs/screenshots/81` and `docs/testing/e2e-baseline.json` instead.
- Measurements that feed the report (load runs, audits, UAT) go in [`../testing/`](../testing/) with the method and
  machine, never invented numbers.
