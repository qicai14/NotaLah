# Sprint 2 (Notes and Feed) — Review and Retrospective

*Planned dates: 27 October – 2 November 2026. Increment completed: 13 October 2026.*

## Sprint goal

	Deliver the content core of PARP: a slide-note editor with drafts and visibility-controlled publishing, a vertical feed, and the peer engagement actions of liking, commenting, reporting and bookmarking (FR8–FR11, FR14, FR16), with profile pages (UC04).

## Sprint review

### Increment delivered

| Item | Evidence |
| --- | --- |
| Slide-note API: drafts, publishing with public or contacts-only visibility, editing, soft deletion, hashtags, module catalogue | `server/src/features/notes/` |
| Server-side sanitising of slide HTML against the editor's allow-list (XSS defence) | `server/src/features/notes/service.ts` |
| Full-text search document built in the same transaction as each save (prepares FR12) | `notes/repository.ts` (`writeChildren`) |
| Vertical feed with stable paging (`asOf`) and a single ordering hook for the Sprint 3 score | `server/src/features/feed/repository.ts` (`FEED_ORDER`) |
| Views, likes, comments with one-level replies and pinned lecturer comments, comment likes, reports, bookmarks | `server/src/features/feed/` |
| Interaction log for the Sprint 3 interest vector, excluding authors' own activity | `"INTERACTION_T"` |
| Profile API (UC04) | `server/src/features/users/` |
| Client: TipTap slide editor, publish dialog with equal-prominence visibility options, drafts, feed with slide viewer and mobile scroll-snap, note detail with comments, report dialog, saved list, profiles | `client/src/features/{notes,feed,users}/`, `client/src/components/` |

### Test results

	All 82 server tests and the first client test pass, and type checking and production builds pass. The prepared NOTE and ENG test tables are automated in full (NOTE-TC1–TC25, ENG-TC1–TC17), together with RANK-TC9 and RANK-TC10 for feed filtering and a new USR table (USR-TC1–TC11) for profiles. Cases beyond the original ten per module were added when a review exposed an untested rule; each was added to the Chapter 4 test tables with the same identifier.

### Quality process

	Each of the three increments (server notes, server feed, client) was reviewed before testing, the findings were fixed, and the full sprint was then reviewed again as a whole. The reviews found one blocking defect, in the client editor: moving from editing a note to creating a new one kept the previous note's content, so saving produced a duplicate. It was fixed by giving each editor route its own component instance and was re-tested in the browser. The sprint-wide review found no blocking defects but identified that authors could like and comment on their own notes and so inflate the engagement component of the Sprint 3 ranking; self-likes are now rejected and authors' own comments and views are excluded from engagement and interest data. This finding is a direct input to Objective 1, since a ranking that can be gamed by its own authors would not reduce information overload.

### Not completed or deferred

- Gaps against the wireframes are listed in `docs/sprints/sprint2_backlog_notes.md` (for example the "why am I seeing this" panel and the profile grid); they do not block any functional requirement.
- The "Verified by" label shows "a lecturer" until Sprint 3 adds the verifier's name with the Super Like feature.
- Avatar upload (UC04) is deferred.

## Sprint retrospective

### What went well

- Writing review findings back into the test tables kept the Chapter 4 test cases and the automated tests identical.
- Sharing one visibility predicate across notes, feed, bookmarks and profiles meant every access rule was tested once and applied everywhere.

### What did not go well

- Usage limits on the development tooling stopped work for about twelve hours mid-sprint; the step log in `docs/PROGRESS.md` made it possible to resume without repeating work.
- The client has only one automated test; client behaviour was verified manually in the browser.

### Actions for Sprint 3

1. Replace `FEED_ORDER` with the heuristic score S = w₁E + w₂R + w₃V + w₄M, computing recency against `asOf`.
2. Implement lecturer Super Like with the verifier's name (FR1–FR3, VER table) and the administrator report queue and account actions (UC20–UC21).
3. Add client tests for the feed paging and editor flows that were only checked by hand.
