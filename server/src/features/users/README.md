# server feature: users

`repository.ts` is the only SQL for `"USER_T"` (accounts, lecturer approval, profiles) and `"FOLLOW_T"` (D38). `routes.ts` serves
`GET /api/users/:id` and `/:id/notes` (readable by guests, D45; public profile with follow counts and state, plus the notes the viewer may see; own profile adds the draft
count), `PUT /api/users/me` (display name, programme, bio), `POST`/`DELETE /api/users/:id/follow` and
`GET /api/users/:id/followers` / `following` (`?cursor=`, 20 per page, newest first). `friends(a, b)` is the one SQL definition
of a mutual follow and is used by the notes `VISIBLE` fragment. Avatar upload is not built yet. Tests: `USR-TC*`.
