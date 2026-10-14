# 15-minute walkthrough — every screen built in Sprints 1-3 (14 Oct 2026)

Purpose: check the app against your expectations before the realign sprint. Not a formal test (the TC tables are).
Write anything that surprises you in the **Notes** column; those notes become backlog items.

**Setup:** `npm run dev` from `FYP_Project/`, open http://localhost:5173. You need three browser sessions at once:
a normal window, a private window and a second browser (or a second browser profile). Use made-up emails such as
`ali@parp.test`. Passwords must be at least 8 characters.

| # | Min | Who / window | Do | Expect | Notes |
|---|---|---|---|---|---|
| 1 | 0:00 | Window 1 | Go to **Register**. Create **Ali**, role *Student*, programme typed in, then log in | Lands on an empty Feed. Desktop sidebar: Feed, Create Note, Drafts, Saved, Profile | Programme is free text today (dropdown = R4) |
| 2 | 1:00 | Window 2 (private) | Register **Dr Lee**, role *Lecturer*, with a staff ID | Account works with student rights (no Super Like). The app shows Dr Lee no "pending" notice; only the admin Users page says "lecturer pending" | Is a notice wanted? |
| 3 | 2:00 | Window 3 | Register **Ben** (Student), log out, log in as the **admin** | Admin links in the header: Lecturer applications, Reports, Users | |
| 4 | 2:30 | Window 3 (admin) | **Lecturer applications**: approve Dr Lee | Dr Lee leaves the list. Reload Window 2: Dr Lee now has the lecturer badge | Rejecting needs a reason |
| 5 | 3:30 | Window 1 (Ali) | **Create Note**: title, pick a module, template *Lecture summary*, 3 slides. Try every toolbar button and move a slide up/down. Add hashtags, then try a 6th | Formatting shows live; the 6th hashtag is refused (max 5) | |
| 6 | 5:00 | Window 1 | Choose **Keep as private draft**, open **Drafts**, reopen it, then **Publish** as *Public* | Publish dialog shows Public / Contacts only / private draft equally (FR10); note appears in the feed | |
| 7 | 6:00 | Window 1 | Create a second short note, publish *Contacts only* | Ali sees it; nobody else will (there is no way to become a contact yet: R2) | |
| 8 | 6:30 | Window 3 (log out admin, log in Ben) | **Feed**: scroll, use the slide arrows, open the note | Ali's public note only, not the contacts-only one. One note per screen, snap scroll | Ranking order needs more data to judge |
| 9 | 7:30 | Window 3 (Ben) | **Like**, **Save**, comment on slide 2, then **Reply** to your own comment | Counts update; the reply is indented one level; replies to replies are not possible | @mentions = R8 |
| 10 | 8:30 | Window 3 | Open **Saved** | Ali's note is listed | |
| 11 | 9:00 | Window 2 (Dr Lee) | Open Ali's note: comment, then **Super Like** with a remark | The lecturer comment is pinned on top with a badge; the note gets the verified frame and "Verified by Dr Lee" in the feed and Saved | |
| 12 | 10:00 | Window 2 | **Remove Super Like**, then Super Like again | Frame disappears and returns, with no dialog | |
| 13 | 10:30 | Window 1 (Ali) | Try to like your own note | Refused ("You cannot like your own note") | |
| 14 | 11:00 | Window 3 (Ben) | **Report this note** → *Spam* → **Send report** | Confirmation; reporting it again is refused | *Plagiarism* reason is lecturer-only |
| 15 | 11:30 | Window 3 (log in admin again) | **Reports**: open the review panel → **Hide note** with a remark | Slides preview in the panel; the report leaves the queue. Ben's feed no longer shows the note | The author gets no notification yet (R8) |
| 16 | 12:30 | Window 3 (admin) | **Users**: search "Ali" → **Restrict**. In Window 1 try Create Note → Publish | Ali can browse and unlike but cannot post or comment | |
| 17 | 13:15 | Window 3 (admin) | Users: **Suspend** Dr Lee, then **Reinstate** | Window 2's next action sends Dr Lee to login ("expired"); while suspended, Dr Lee's notes vanish for others | |
| 18 | 14:00 | Window 1 (Ali) | **Profile** → **Edit profile** (programme, bio), then open Ben's profile from a comment | Changes show at once; Ben's profile lists only notes Ali may see | Follow button = R2 |
| 19 | 14:30 | Any | Narrow the window to phone width | Bottom tabs: Feed, Create, Saved, Me | |

**Not built yet (don't look for it):** search and filters, messaging and group chats, follow/friends, Following feed,
notifications and @mentions, "why am I seeing this" panel, background audio, annotations, admin Modules page,
programme dropdown, httpOnly-cookie login. All are in `PLAN.md` → Realign backlog / Sprint 4.
