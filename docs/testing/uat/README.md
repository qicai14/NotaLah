# docs/testing/uat

User acceptance test plan, participant results and sign-off (Ch 5.4). The plan and results are filled in during
Finalisation; this page covers the data the participants use.

## UAT seed (#82)

Adds UAT accounts, 3 modules and 14 published notes and 1 hidden note (with valid slide decks) to the database `DATABASE_URL` points at.
It never truncates or deletes: existing users, modules and notes are kept, and running it twice adds nothing new. It
does not reset the password of an account that already exists.

```
vp run server#uat:seed
```

It prints the database name and how many rows were inserted and how many were skipped because they already existed.
`UAT_PASSWORD` sets the password of newly created accounts (at least 8 characters, at most 72 bytes; the seed stops
with an error otherwise). It sets one password for every role. Without it each role gets `${role}123` (see the table). Use it only for UAT,
never as a real credential. With `NODE_ENV=production` the seed refuses to run without `UAT_PASSWORD`, because the defaults are public.

To wipe and reseed a local dev database (the one `vp run db:up` creates, `notalah`), opt in by naming it exactly:

```
UAT_RESET_DATABASE=notalah vp run server#uat:reset
```

It empties every table except `schema_migrations` and `MODULE_T`, so all dev data is lost. Without the variable the
reset only runs on `notalah_test` and `notalah_test_*`; it never runs with `NODE_ENV=production`.

Never use `load:seed` for UAT: it wipes the database and refuses anything not named `notalah_test_*`.

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin (NotaLah Admin) | admin@gmail.com | admin123 | Moderation and lecturer approval; owns no notes |
| Lecturer (Dr Aisha Rahman, approved) | aisha@gmail.com | lecturer123 | Can verify notes |
| Student 1 (Daniel Tan) | daniel@gmail.com | student123 | Author of the hidden note, the target of the admin's suspend step |
| Student 2 (Priya Nair) | priya@gmail.com | student123 | |
| Student 3 (Wei Jie Lim) | weijie@gmail.com | student123 | |

To log in, start the app (`vp run dev`), open the login page and sign in with one of the emails above and its password. Seeded modules are `UAT101-3-2` (Database Systems), `UAT102-3-2` (Operating Systems and Networks) and
`UAT103-3-2` (Agile Software Development); notes carry the hashtag `uat`; 14 published public notes show on the feed.

The notes belong to the lecturer and the students, so they appear on those profiles and in search (try `uat`).

Moderation data: one note ("Copied exam answers (hidden)") is hidden and is the most recently hidden note; its
author is Daniel Tan. Three open reports are seeded (two on the hidden note, one on "Subnetting made simple"),
all by other seeded students, so the admin queue is not empty. A rerun adds no second report.
