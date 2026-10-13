# server feature: moderation

Admin-only routes under `/api/admin` (`requireAuth`, `requireRole('admin')` on the whole router): lecturer approval
(UC22), the report queue (UC20) and account actions (UC21). Lecturer Super Like is in `features/verification`.

Serves: FR19 and the IR administrator deliverables. Test table: `ADM-TC*` in `docs/chapter4/4.5_test_cases.md`;
tests in `server/tests/moderation/`. Decisions: D6, D18, D26.

| Method and path | Result |
| --- | --- |
| `GET /lecturer-applications`, `POST /lecturer-applications/:userId/{approve,reject}` | UC22 (D18) |
| `GET /reports` | `{groups}`: one entry per note with open reports, the note with the oldest open report first; each is the full note plus `reportCount`, `oldestReportAt`, `reports[] {id, reason, details, reporter, createdAt}` |
| `POST /reports/:noteId/resolve` | `{outcome: 'dismiss' or 'hide', remark}` (remark required, max 300); dismiss: open reports -> dismissed; hide: note -> hidden and open reports -> upheld; resolver and time stored in one transaction; 404 when the note has no open reports |
| `GET /users?q=` | `{users}`: first 50 accounts whose name or email contains q, with role, status, lecturer status and upheld report count |
| `POST /users/:userId/{restrict,suspend,reinstate,delete}` | `{reason}` required (max 300); status change plus an `"ACCOUNT_ACTION_T"` row in one transaction; delete anonymises the profile (name "Deleted user", email `deleted-<id>@invalid`, bio/avatar/staff ID cleared) and hides the user's published notes; 403 on an administrator, 404 unknown, 409 already deleted |

Existing tokens of suspended or deleted users fail on the next request because `requireAuth` reloads the account.
