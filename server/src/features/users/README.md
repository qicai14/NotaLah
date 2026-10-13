# server feature: users

`repository.ts` is the only SQL for `"USER_T"` (accounts, lecturer approval, profiles). `routes.ts` serves
`GET /api/users/:id` (public profile plus the notes the viewer may see; own profile adds the draft count) and
`PUT /api/users/me` (display name, programme, bio). Avatar upload is not built yet. Tests: `USR-TC*`.
