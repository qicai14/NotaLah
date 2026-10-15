# Sprint 4 spec: search, messaging, notifications, blocking (D47, agreed 16 Oct)

Backend first (the UI waits for wireframe sign-off). Order: search, terms admin, blocking, Socket.io + messaging, R8.

## Search (FR4, FR5/NFR1, FR12, FR15; SRCH-TC1-10)
- `GET /api/search?q=&tab=top|notes|people|hashtags|modules&lecturer=any|<userId>&term=<id>&from=&to=&cursor=`;
  optional auth (guests search public notes, D44); IP guest limit.
- Matches module code/name, programme, hashtags, title and slide full text (`pst_search_doc`, GIN), people by display
  name. Visibility through the shared `VISIBLE` rule; suspended users and their notes never appear (D47).
- Note order: blend of text rank and the feed's E and V (weights in `ranking/config.ts`, NFR5), ties by newest. If
  SRCH-TC10 (10,000 notes) misses 3 s, switch to text rank only and log it.
- Filters: lecturer content (authored or Super Liked by a lecturer) or one named lecturer; term (dates from `"TERM_T"`);
  custom date range (400 when from > to).

## Terms (FR15)
- `"TERM_T"` (name, start, end), empty at first; admin CRUD under `/api/admin/terms`; `GET /api/terms` public.

## Blocking
- `"BLOCK_T"` (blocker, blocked). Either direction stops follow, message and message request; the blocked user cannot
  comment on, like or see the blocker's notes and profile, and vice versa. Blocking removes follows both ways.

## Messaging (FR6, FR7, FR13, FR16; MSG-TC1-10; UC15-18)
- Socket.io on the same server; handshake auth from the `parp_token` cookie plus an Origin check (D35); `io.close()`
  before `server.close` on shutdown (D41).
- Friends message directly; a non-friend's first message is a request holding the note card; accepting opens the chat
  without a follow (D9, D38). Blocked pairs cannot message.
- Messages: text up to 2,000 chars, optional note card (FR7), optional reply-to message id, soft delete by sender
  ("message deleted"), read receipts (last-read message per member), typing indicator (not stored). Images in chat come
  after R22 (Sprint D) through its upload pipeline.
- Groups: name, 2-29 friends plus creator (max 30); any member adds their own friends; anyone leaves; creator renames
  and removes members.
- REST for history (keyset paging, 50) and conversation lists; Socket.io for live delivery.

## Notifications (R8)
- `"NOTIFICATION_T"`; live over Socket.io; in-app only; purged after 30 days (daily job like D34).
- Types: @mention (thread participants and friends), Super Like, follow, lecturer approval (UC22), hidden note (UC20),
  message request, collaboration request and decision (R30), "edited since verification" to the verifying lecturer.
