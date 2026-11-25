# 0104 - Authentication: JWT in an httpOnly cookie with a CSRF header (D35, #152, 26 Nov 2026)

- **Context:** the IR cites the XSS risk of tokens kept in script-readable storage; the app also needs roles
  (student, lecturer, admin) and a socket handshake that shares the session.
- **Decision:** login sets an HttpOnly, SameSite=Lax JWT cookie (HS256, one hour, `Secure` in production); the token is
  never in a response body and the Bearer extractor is removed. Every non-safe `/api` request must carry
  `X-Requested-With`, and CORS allows only `CLIENT_ORIGIN`, so a cross-site page cannot add the header. Role and status
  are read from the database on every request, so suspension takes effect at once. The Socket.io handshake checks
  `Origin` and authenticates the same cookie with passport-jwt. Passwords are bcrypt hashes. Lecturer accounts need
  admin approval (D6 in [DECISIONS.md](../DECISIONS.md)).
- **Alternatives:** double-submit CSRF token (more plumbing, no gain while CORS is locked to one origin);
  SameSite=Strict (users arriving from an email or Moodle link would be logged out); keeping a Bearer header too (any
  script that can read a token defeats httpOnly).
- **Reversibility:** Medium (server extractor, CORS and CSRF middleware, client api wrapper and auth context).
- **Tests:** AUTH-TC11 to AUTH-TC16.
