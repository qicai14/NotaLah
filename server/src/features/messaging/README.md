# server feature: messaging

Will hold: Post-anchored private messages, message requests and named group chats over Socket.io. Friends (a mutual follow, `friends()` in `users/repository.ts`, D38) message directly; a non-friend's first message is a request, and approving it opens that conversation without making them friends.

Contents: conversation repositories, routes and the Socket.io gateway.

Serves: FR6, FR7, FR13. Test table: `MSG-TC*` in `docs/chapter4/4.5_test_cases.md`.

Filled in: Sprint 4. See `docs/ARCHITECTURE.md` for the layering rules.

Auth note (D35): the Socket.io handshake must authenticate from the same httpOnly `parp_token` cookie (parse
`socket.request.headers.cookie`, verify with passport-jwt's rules and reload the user from the DB), and must reject a
handshake whose `Origin` is not `CLIENT_ORIGIN`, since WebSockets are not covered by CORS or the CSRF header check.
