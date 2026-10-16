# server feature: notifications

In-app notification inbox (R8, D51), stored in `"NOTIFICATION_T"` and pushed live over the messaging Socket.io gateway.
Test table: `NTF-TC*` in `docs/chapter4/4.5_test_cases.md`; tests in `server/tests/notifications/`.

- `config.ts`: retention (30 days), per-type dedupe windows, mention and page limits.
- `repository.ts`: all SQL: the guarded insert, mention and voided-verifier lookups, list, unread count, mark read, purge.
- `service.ts`: `notify(notification, recipients)`, which other features' routes call after their write commits. It
  never throws, so a failed notification cannot fail the action. `notifyMentions` for comments.
- `routes.ts`: `notificationsRouter` at `/api/notifications`, login required.

Types and where they are raised:

| Type | Raised by | Recipient |
| --- | --- | --- |
| `mention` | `POST /api/notes/:id/comments` with `mentions` | named users who are the note's author, in the same thread, or the commenter's friends, and can see the note |
| `super_like` | `POST /api/notes/:id/verify` (new Super Like) | note author |
| `follow` | `POST /api/users/:id/follow` (new follow) | followee |
| `lecturer_approved`, `lecturer_rejected` | admin decision (UC22) | applicant; no actor |
| `note_hidden` | admin resolves reports with `hide` (UC20) | note author; no actor |
| `message_request` | `POST /api/messages` that becomes a request | recipient |
| `collab_request` | `POST /api/notes/:id/requests` | note owner |
| `collab_approved`, `collab_declined` | owner decides a request | requester |
| `edited_since_verification` | `PUT /api/notes/:id` that voids Super Likes (D46) | each voided lecturer, once until they re-confirm |

Delivery rules (in one INSERT): never the actor, only active or restricted recipients, nobody in a block with the actor,
and no repeat of an identical notification inside its type's dedupe window. Listing and counts also hide notifications
whose actor is now suspended, deleted or in a block with the recipient.

Endpoints:

| Method and path | Result |
| --- | --- |
| `GET /api/notifications?type=&cursor=&limit=` | `{notifications, nextCursor}`, newest first, 20 per page; `type` is one type or a comma list |
| `GET /api/notifications/unread-count` | `{unreadCount: {total, byType}}` |
| `POST /api/notifications/read` | `{ids?}`; marks those (or all) read; `{unreadCount}` |

Socket events on `user:<id>`: `notification:new {notification, unreadCount}` and `notification:count {unreadCount}`
(after a mark read, for the user's other tabs).
