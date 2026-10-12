# Sprint 1 (Architecture and Data) — Review and Retrospective

*Planned dates: 20–26 October 2026. Increment completed early: 13 October 2026, immediately after Sprint 0.*

## Sprint goal

	Establish the multi-tier architecture of PARP and the data layer defined in Chapter 4, and deliver secure registration, login and server-side role separation for students, lecturers and administrators, so that every later feature is built on authenticated, role-checked requests (Objective 3; role separation for FR1).

## Sprint review

### Increment delivered

| Item | Evidence |
| --- | --- |
| React + Vite + TypeScript + Tailwind CSS client with routing, session handling and mobile-first layout | `client/src/` |
| Express 5 + TypeScript API with security headers, CORS, JSON error handling | `server/src/app.ts` |
| PostgreSQL 17 in Docker Compose with separate development and test databases | `docker-compose.yml`, `docker/initdb/` |
| Versioned plain-SQL migrations (dbmate): initial schema (19 tables) and seeded module catalogue | `server/db/migrations/` |
| Ranking constants in one validated configuration module (NFR5) | `server/src/config/ranking.ts` |
| Registration, login, logout and current-user endpoints using Passport (local + JWT) and bcrypt | `server/src/routes/auth.ts`, `server/src/auth/passport.ts` |
| Server-side role enforcement (`requireAuth`, `requireRole`), re-reading role and status from the database on every request | `server/src/middleware/auth.ts` |
| Administrator approval of lecturer accounts (UC22) with an audit record per decision | `server/src/routes/admin.ts`, `"ACCOUNT_ACTION_T"` |
| First-administrator bootstrap script (no credentials in the repository) | `server/src/scripts/createAdmin.ts` |
| Login, registration and lecturer-application pages | `client/src/pages/` |

### Test results

	All 27 automated tests pass (`npm test`, verified independently after implementation), and type checking and production builds pass for both the client and the server. The test cases prepared in Section 4.5 for this sprint are all automated with their identifiers in the test names: AUTH-TC1 to AUTH-TC10, ADM-TC1, ADM-TC9 and ADM-TC10, together with RANK-TC8 for the weight configuration. The remaining tests cover supporting behaviour such as JSON 404 responses, ordering of pending applications and the administrator bootstrap script. A manual browser check confirmed the registration error states, successful registration, the generic login error, login to the protected feed, denial of the administrator page to a student, and logout clearing the stored session.

*Table S1.1: Sprint 1 test case results*

| TC ID | Description | Result |
| --- | --- | --- |
| AUTH-TC1 | Blank registration fields each return an error; no account created | Pass |
| AUTH-TC2 | Invalid email format rejected | Pass |
| AUTH-TC3 | Password shorter than 8 characters (and longer than 72 bytes) rejected | Pass |
| AUTH-TC4 | Mismatched confirmation rejected | Pass |
| AUTH-TC5 | Valid student created with a 60-character bcrypt hash | Pass |
| AUTH-TC6 | Duplicate email rejected with 409 | Pass |
| AUTH-TC7 | Lecturer registration creates a pending student who cannot use lecturer routes | Pass |
| AUTH-TC8 | Wrong password and unknown email receive the same 401 | Pass |
| AUTH-TC9 | Valid login returns a signed token; current user returned | Pass |
| AUTH-TC10 | Missing, tampered and valid tokens; suspended login; token revoked by suspension | Pass |
| ADM-TC1 | Student and lecturer tokens receive 403 on administrator endpoints | Pass |
| ADM-TC9 | Approving a lecturer application changes the role and logs the action | Pass |
| ADM-TC10 | Rejecting requires a reason, keeps the student role and logs the action | Pass |
| RANK-TC8 | Weights read from configuration; invalid weight sums rejected at start-up | Pass |

### Not completed or deferred

- The development database has not been migrated: the migration command was held by the workstation's command guard during the unattended run and is left for the developer to run (`npm run db:migrate -w server`). The test database is migrated automatically by the test setup.
- Closing the real-time connection on logout (UC03 step 3) and notifying users after a lecturer application decision (UC22 step 5) depend on Socket.io, which arrives in Sprint 4.
- The login rate limit is disabled in the test environment and is therefore not covered by an automated test.

## Sprint retrospective

### What went well

- The test cases written in Sprint 0 served directly as the acceptance criteria: each was implemented as an automated test with its identifier, so this review table was filled from test output rather than from memory.
- Reloading the user's role and status on every request made two requirements cheap to prove: a suspension takes effect on the user's very next request, and an approved lecturer gains lecturer rights without logging in again.
- Plain SQL migrations meant the schema validated in Sprint 0 was applied unchanged, and the SQL in the repository is the SQL that will appear in Chapter 5.

### What did not go well

- The initial scaffold could not be fully verified by the agent that built it, because database migrations were held by the command guard; verification moved to a separate run of the test suite. Running tests against an isolated test database avoided the need to touch the development database at all.
- A dependency audit reported two findings in a development-only tool (`concurrently`) whose fix had been released too recently for the project's two-week rule on new versions; the upgrade is scheduled rather than taken immediately.

### Actions for Sprint 2

1. Developer to run the development migration and create the first administrator account (`npm run admin:create -w server`), then review the lecturer approval flow in the browser.
2. Decide whether the programme field at registration should become a selection list fed from `"MODULE_T"` (D17), as shown in the Edit Profile wireframe, before search (FR4) depends on its values.
3. Begin Sprint 2 (slide-note editor, drafts, publishing, vertical feed, likes, comments, reports, bookmarks) against the NOTE and ENG test tables.
