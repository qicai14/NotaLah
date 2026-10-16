# server feature: messaging

Post-anchored private messages, message requests and named group chats (FR6, FR7, FR13, FR16; UC15-UC18; D50).
Friends (a mutual follow, `friends()` in `users/repository.ts`, D38) message directly. A non-friend's first message is
a request, and accepting it opens that conversation without making them friends. Blocked pairs cannot message or send
requests (`blockedWith` / `isBlocked` from `users/repository.ts`, D49).

Contents: `config.ts` (limits), `repository.ts` (all SQL), `routes.ts` (REST under /api; every write goes here, so it
gets the CSRF check, the shared write limiter and `requireActive`), `socket.ts` (the Socket.io gateway: handshake,
rooms, typing relay, and the `emit`/`joinConversation` helpers routes use for live delivery).

Auth (D35): `allowRequest` refuses any engine request whose `Origin` is not `CLIENT_ORIGIN`, because WebSockets are not
covered by CORS or the CSRF header check. The handshake then runs passport-jwt on the `parp_token` cookie and reloads
the user, so suspended and deleted accounts are refused. Sockets close when the token expires, and an admin suspension
or deletion disconnects them at once. `io.close()` runs on shutdown before the HTTP server closes (D41).

Rooms: `user:<id>` and `conv:<id>`. Server events: `message:new`, `message:deleted`, `request:new`, `request:accepted`,
`conversation:read`, `conversation:updated`, `conversation:removed`, `typing`. Client event: `typing {conversationId}`.

Tests: `MSG-TC*` in `docs/chapter4/4.5_test_cases.md`; `server/tests/messaging/`.
