# server feature: users

`repository.ts` is the only SQL for `"USER_T"` (accounts, lecturer approval, profiles), `"FOLLOW_T"` (D38) and `"BLOCK_T"` (D49). `routes.ts` serves
`GET /api/users/:id` and `/:id/notes` (readable by guests, D45; public profile with follow counts and state, plus the notes the viewer may see; own profile adds the draft
count), `PUT /api/users/me` (display name, programme, bio), `POST`/`DELETE /api/users/:id/follow` and
`GET /api/users/:id/followers` / `following` (`?cursor=`, 20 per page, newest first). `friends(a, b)` is the one SQL definition
of a mutual follow and is used by the notes `VISIBLE` fragment. Blocks (D49): `POST`/`DELETE /api/users/:id/block` and
`GET /api/users/me/blocks` (`?cursor=`, 20 per page); a profile you blocked returns only `{id, displayName, blockedByMe: true}`,
one that blocked you is 404. `blockedWith(v, other)` is the one SQL definition of a block in either direction (joined into
`VISIBLE`, `COLLAB_ROLE`, comment visibility, people search and follow) and `isBlocked(a, b)` its TypeScript form. Avatar
upload is not built yet. Tests: `USR-TC*`, `BLK-TC*`.
