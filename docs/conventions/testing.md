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
- Test cage (#151): CI job `cage` fails a PR that removes assertions or tests, adds `.skip`/`.only`/`.todo` or deletes a
  test file, unless the PR body has a line `Test-change: <PREFIX-TCn> <reason>` (same line). Run it locally with
  `BASE_REF=origin/main node scripts/check-test-edits.mjs`.
- CRAP gate (#151): CI job `crap` runs the server tests with coverage on PRs touching `server/src` or `shared/src` and
  fails when a function the PR touched scores above 30 (`node scripts/crap.mjs server/coverage/coverage-final.json 30`;
  baseline in [`../testing/cage-baseline.md`](../testing/cage-baseline.md)). Known limits of the guard: it does not catch
  loosened tolerances or a new test offsetting a removed one in the same file.
- Mutation (#151): `cd server && vp exec stryker run --mutate src/path/file.ts` (Stryker, break below 50); the PR job
  `mutation` is advisory, a nightly workflow reports the full score. Cost and baseline: [`../testing/cage-baseline.md`](../testing/cage-baseline.md).
- Lighthouse (#81): `vp run test:lighthouse` (same prerequisites as `test:e2e`) writes `docs/testing/lighthouse.json`; the
  readable table is [`../testing/lighthouse.md`](../testing/lighthouse.md).
