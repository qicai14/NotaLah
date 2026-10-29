# 0088 - Socket cut before token expiry; renew before reconnect (issue #79, 29 Oct 2026)

- **Context:** D65 cut a socket at its JWT's exact expiry, but the cookie only renews on an authenticated REST call, so a
  chat tab left open for an hour reconnected with an expired cookie and showed "Live updates are offline".
- **Decision:** the server cuts a socket `CUT_BEFORE_EXPIRY_MS` (10 minutes, derived from the 15-minute
  `REFRESH_BELOW_SECONDS`) before its token expires. On `io server disconnect` the client calls `GET /api/auth/me`, which
  renews the cookie through `slideSession`, and only then reconnects (same 1-3 s jitter). A renewable token that
  connects with 10 minutes or less left (socket.io's own reconnect after a transport drop) is cut at once, so it goes
  through the same renewal. A token that cannot be renewed (`MAX_SESSION_HOURS` reached, or no `auth_time`) is cut at
  its real expiry, so it never loops. A failed renewal shows the offline banner; a 401 ends the session as before. The
  "can this token be renewed" rule is `isRenewable` in `passport.ts`, shared by `slideSession` and the socket. Amends D65.
- **Trade-off:** an open tab with messaging mounted now renews itself about every 50 minutes without any user activity,
  so an unattended signed-in tab stays signed in until `MAX_SESSION_HOURS` (12 h) after login instead of about 1 hour.
  The issue requires this (an idle chat tab must keep receiving messages); the absolute 12 h cap is unchanged. Whether
  to add an idle limit is in `docs/OPEN_QUESTIONS.md`.
- **Alternatives:** renew from the client on a timer (a second clock to keep in step with the server); reconnect
  without renewing and let the handshake fail (the bug); a socket-side token refresh event (new protocol surface).
- **Reversibility:** High; a constant and a few lines in `socket.ts` and `MessagingContext.tsx`.
- **Amended 29 Oct (#93):** the client skips the renewal when the tab has had no pointer or key activity for
  `IDLE_LIMIT_MS` (50 minutes; focus and visibility do not count). That cut is final until the next activity, which runs
  the same renew-then-reconnect once. An unattended tab is signed out when its cookie expires, about 60 to 110 minutes
  after the last activity depending on where in the token hour it went idle; coming back later meets the 401 sign-in.
  This is a client-side limit, not a server-enforced idle timeout, and it covers messaging only: an open editor still
  renews its edit lock every 45 s (`useEditLock`), which slides the session up to the 12 h cap.
- **Amended 29 Oct (#96):** the editor lock follows the same limit. `useEditLock` skips its 45 s renewal while the tab
  has been idle for `IDLE_LIMIT_MS` and checks again each 45 s, so the lock and the session lapse as for a closed tab;
  the first tick after activity takes the lock again, or meets 423 and waits read-only with unsaved edits kept. The
  first take on open and the retries while locked or on error are not gated. Both features read one activity tracker,
  `client/src/lib/activity.ts`.
- **Tests:** MSG-TC28 to MSG-TC31, DEP-TC9, CLI-TC93 to CLI-TC97.
