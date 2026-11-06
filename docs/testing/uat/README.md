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
with an error otherwise). Without it the default in `server/src/scripts/uat/data.ts` is used. Use it only for UAT,
never as a real credential. With `NODE_ENV=production` the seed refuses to run without `UAT_PASSWORD`.

Never use `load:seed` for UAT: it wipes the database and refuses anything not named `notalah_test_*`.

| Role | Email | Notes |
|---|---|---|
| Admin | uat.admin@mail.apu.edu.my | Moderation and lecturer approval; owns no notes |
| Lecturer (approved) | uat.lecturer@mail.apu.edu.my | Can verify notes |
| Student 1 (Daniel Tan) | uat.student1@mail.apu.edu.my | Author of the hidden note, the target of the admin's suspend step |
| Student 2 | uat.student2@mail.apu.edu.my | |
| Student 3 | uat.student3@mail.apu.edu.my | |

To log in, start the app (`vp run dev`), open the login page and sign in with one of the emails above and the UAT
password. Seeded modules are `UAT101-3-2` (Database Systems), `UAT102-3-2` (Operating Systems and Networks) and
`UAT103-3-2` (Agile Software Development); note titles start with `UAT:` and carry the hashtag `uat`.

The notes belong to the lecturer and the students, so they appear on those profiles and in search (try `UAT:`).

Moderation data: one note ("UAT: Copied exam answers (hidden)") is hidden and is the most recently hidden note; its
author is Daniel Tan. Three open reports are seeded (two on the hidden note, one on "UAT: Subnetting made simple"),
all by other seeded students, so the admin queue is not empty. A rerun adds no second report.
