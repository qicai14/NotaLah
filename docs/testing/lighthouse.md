# Lighthouse accessibility evidence (#81)

Method: `vp run test:lighthouse` starts the same stack as the E2E suite (Docker Postgres, `notalah_test_81` migrated and
reseeded by `server#uat:reset`, Vite dev server, AI stub), then `scripts/lighthouse-evidence.mjs` runs Lighthouse 13.6.0
(accessibility category only, headless Chromium from Playwright, Lighthouse default settings, which emulate a mobile device) once per page.
Signed-in pages use the session cookie of a real login as the seeded UAT user, and the run fails if a signed-in page is
redirected. Results: [`lighthouse.json`](lighthouse.json). Run on 26 Nov 2026, Windows 11, AMD Ryzen 3 3300X, 16 GB.

| UAT page | URL | Signed in as | Final path | Accessibility score | Failed audits |
| --- | --- | --- | --- | --- | --- |
| Log in | `/login` | guest | `/login` | 100 | none |
| S3 feed (guest) | `/` | guest | `/welcome` | 100 | none |
| S4 search | `/search` | guest | `/search` | 100 | none |
| S2 editor | `/notes/new` | student1 | `/notes/new` | 100 | none |
| S5 messages | `/messages` | student1 | `/messages` | 100 | none |
| L2 feed | `/` | lecturer | `/` | 100 | none |
| A2 reports | `/admin/reports` | admin | `/admin/reports` | 100 | none |

Notes:
- A guest opening `/` is sent to `/welcome`, so that row measures the welcome page.
- Lighthouse checks one page state. The interactive states (open dialogs, editor panels, chat threads) are covered by the
  axe checks in the E2E suite (`e2e/helpers/axe.ts`, zero serious or critical violations), so the two are complementary.
- The measurement runs against the Vite dev server, which is fine for an accessibility score; do not read performance
  numbers from it (the performance category was not run).
