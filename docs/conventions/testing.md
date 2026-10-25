# Testing

- Every test is named with its TC ID from [`../chapter4/4.5_test_cases.md`](../chapter4/4.5_test_cases.md), and every
  new test gets a row there. IDs are unique across the repo: check the highest number for the prefix before adding.
- Server: `server/tests/<feature>/` against the real `notalah_test` database; run `vp run server#test` (a bare
  `vp test` from the repo root skips the server test config).
- Client: `*.test.ts(x)` beside the code; render tests start with `// @vitest-environment jsdom`; run `vp run client#test`.
- Browser checks: `agent-browser` for exploration; Playwright Test for the E2E smoke suite (skill
  `playwright-best-practices`).
- Measurements that feed the report (load runs, audits, UAT) go in [`../testing/`](../testing/) with the method and
  machine, never invented numbers.
