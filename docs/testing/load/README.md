# Load testing and live-site evidence (R27, D80)

Evidence for NFR1 (search results within 3 seconds under normal load) and for feed latency under UAT-sized load.
Local runs are what Chapter 6 cites; the live run, keep-awake ping and restore drill are the owner's deployment goals.

| Piece | Where |
|---|---|
| Seed (300 users, 2,000 notes, 60 days) | `server/src/scripts/load/seed.ts` (`vp run server#load:seed`) |
| Local runner (Node, no dependencies) | `server/src/scripts/load/run.ts` (`vp run server#load:run`) |
| Percentiles and NFR1 verdict | `server/src/scripts/load/stats.ts` (tests OPS-TC12 to OPS-TC14) |
| k6 script for the live site | `load/k6/notalah.js` |
| Local results | `2026-10-22_local.md`; raw output in `runs/` (one `.md` and `.json` per run) |

## Run it locally

The seed truncates every table, so it refuses to run unless the database name starts with `notalah_test_` (OPS-TC14).
Use a database of its own: the server tests truncate `notalah_test` and would wipe the load data.

1. Point `DATABASE_URL` at a new database, for example `.../notalah_test_load` (same host and credentials as the root
   `.env`; set it in the shell, do not edit `.env`), then `vp run server#db:migrate` creates and migrates it.
2. `vp run server#load:seed` (about 15 s; same arguments give the same data, `LOAD_USERS`, `LOAD_NOTES`, `LOAD_DAYS`
   change the size; `LOAD_VIDEO_EVERY=N` gives every Nth note one shared ready video on its first slide). Accounts are `load1@mail.apu.edu.my` to `load300@...`, the first 20 approved lecturers; the password is
   `LOAD_PASSWORD` in `data.ts`.
3. `vp run -r build`, then start the built server in production mode so the production startup guards are the ones
   measured. Locally that needs these values in the shell (all dummies; no upload route is used):
   `NODE_ENV=production PORT=4104 TRUST_PROXY=2 PROXY_SECRET=<16+ random chars> STORAGE_DRIVER=r2 R2_ACCOUNT_ID=x
   R2_ACCESS_KEY_ID=x R2_SECRET_ACCESS_KEY=x R2_BUCKET=x CLIENT_ORIGIN=https://example.invalid DATABASE_URL=<load db>`,
   then `node server/dist/server.js`.
4. `LOAD_PROXY_SECRET=<same secret> vp run server#load:run --vus 50 --duration 90 --client-ips --label my_run`.
   Options: `--base` (default `http://127.0.0.1:4104`), `--vus` (50), `--duration` seconds (60), `--think` mean think time
   ms (1000), `--users` (300), `--out` (default `docs/testing/load/runs`), `--client-ips`.
5. Sequential p95 probe (300 ms target, #78): `vp run server#load:latency` (`--base` default `http://127.0.0.1:4000`, `--user` 21,
   `--warmup` 5, `--n` 100, `--gap` 210 ms between requests to stay under the 300 reads per minute limit).
   The seeded video's files live where the local driver reads keys, `STORAGE_DIR` (default `<repo>/uploads`):
   `uploads/v/00000000-0000-4000-8000-000000000078.mp4` and poster `uploads/p/00000000-0000-4000-8000-000000000078.webp`.

### Rate limiters (D65)

No limiter is disabled. The `NODE_ENV=test` switch that turns them off is not used: running in production mode and
skipping limiters would not be honest, and a test-mode server is a different configuration. Instead each VU is a separate
user with its own client address, as real students are: with `--client-ips` the runner sends
`X-Forwarded-For: <vu address>, 10.255.255.254`, which `TRUST_PROXY=2` reads the same way as the Pages Function chain
(D74). Login (60 per minute per address) and signed-in writes (120 per minute per user) then stay far from their limits:
a VU writes (view, like or comment) in 22% of iterations, about 12 a minute at 25 VUs. A real campus lab behind one address would share the 60 per minute login budget, which
this test does not model (the guest read limit of 120 per minute per address is also not exercised, as every VU is signed in).

## Live run (owner to do, not run in this session)

1. Install k6 (free): `winget install k6.k6` or `choco install k6`.
2. The Pages Function quota is 100,000 requests a day, shared with real users. Every `/api` call is one request.
   Budget (default 10 VUs, 3 min, think time 1.5 s mean, reads only): one request per iteration of about 2 s, so
   about 10 x 90 = 900 requests plus 10 registrations and 10 logins: roughly 1% of a day. A 25 VU, 5 min run is about
   3,800 (3.8%). Keep the total for a day under 10,000 and never run during a UAT session.
3. Run: `k6 run -e BASE=https://<project>.pages.dev -e PASSWORD=<a throwaway password> load/k6/notalah.js`
   (`-e VUS=25 -e DURATION=5m` to scale up, about 25 VUs at most: register and login share the 60 per minute auth
   limit of your address, so `setup()` registers first and waits 61 s before the staggered logins). It registers `loadtest1` to `loadtestN@mail.apu.edu.my`; they are real accounts, so
   delete them afterwards from the admin Users page. The script only reads (feed, search, note, comments): it never views, likes or comments, so it writes nothing to real users' notes.
4. The threshold `http_req_duration{kind:search}` p(95) < 3000 is NFR1. Screenshot the end-of-test summary for Chapter 6.
5. Render free runs at 0.1 CPU and may be asleep: the first request after idle takes about a minute. Wake it first
   (open the site, wait for `/api/health`) and note whether the run started warm.

## Keep-awake ping (to-do)

Render spins a free web service down after 15 minutes without inbound traffic and gives each workspace 750 free instance
hours a month (checked 22 Oct 2026 on render.com/docs/free). One always-awake service uses 24 x 31 = 744 hours, so it fits
only while it is the workspace's single free service (the video worker must not be a second free service).
The Render page does not say whether pings are allowed, so confirm before relying on it. UptimeRobot free: 5 minute minimum
interval, 50 monitors, no stated commercial restriction. Steps: add an HTTP(S) monitor on
`https://<project>.pages.dev/api/health`, interval 5 minutes, alert contact your email. A ping every 5 minutes is about
288 requests a day through the Pages Function (0.3% of quota). Hit the Pages URL rather than onrender.com, which refuses
requests without the proxy secret except `/api/health`. Turn it off after the examination if the hours matter.

## Neon restore drill (to-do)

Goal: prove the data can be recovered, and record the time it takes.
1. In the Neon console open the project, **Backup & Restore** on the `main` branch. Note the history window for the Free
   plan (neon.com/docs/postgres/backup-restore/history-window; not verified here).
2. Record a marker: insert a note titled `restore-drill` through the app and note the time.
3. Delete that note (or a throwaway row) and note the time, a few minutes after step 2.
4. **Restore**, branch `main`, **From history**, a timestamp between steps 2 and 3, **Next**, review, **Restore**.
   Optionally check the candidate time first with Time Travel Assist.
5. Confirm the note is back in the app, the `schema_migrations` count is unchanged, and `/api/health` reports `db: up`
   (connections are briefly interrupted; Render reconnects through the pool).
6. Neon creates a backup branch `main_old_<timestamp>` holding the pre-restore state; keep it until the drill is written
   up, then delete it. Screenshot steps 4 and 5 and the elapsed time for Chapter 6.
