# Sprint 4 (search, messaging, notifications): interview prep

Drafted 15 Oct while the user was away. This is not an agreed spec. It lists what is already decided, so the interview
only covers the open questions. Recommended answers are marked (R).

## Already decided (no need to ask again)
- **Search (FR4, FR5/NFR1, FR12, FR15):** one search covers module code, hashtag, keyword and slide full text,
  programme and people (SRCH-TC1-10). Filters: lecturer content (authored or Super Liked by a lecturer, or one named
  lecturer), academic term from a seeded `"TERM_T"`, and a custom date range (D2, R7). Under 3 s with 10,000 notes.
  Guests can search public notes (D44). Wireframes v3 screens 07 and 34-36.
- **Messaging (FR6, FR7, FR13, FR16):** Socket.io with handshake auth from the `parp_token` cookie plus an Origin check
  (D35). Friends (mutual follow) message directly. A non-friend's first message is a request carrying the note, and
  accepting it opens the chat without making them friends (D9, D38). Group chats only with friends (UC18, D43).
  MSG-TC1-10. Screens 42-47.
- **Notifications (R8):** `"NOTIFICATION_T"`, live over Socket.io. Covers @mentions (thread participants and friends),
  lecturer approval (UC22), hidden note (UC20) and message requests. R30 adds collaboration requests and "edited since
  verification" for the verifying lecturer. Screens 40-42.

## Open questions
1. **Search ranking:** order results by Postgres text rank only (R), or blend in the feed's E/V signals?
2. **Academic terms to seed:** which APU terms and dates? (R) The user supplies the 2026/27 calendar; until then, seed
   placeholder semesters and mark them in D-log.
3. **Search result tabs:** Top, Notes, People, Hashtags, Modules as in screen 34 (R), or Notes and People only?
4. **Message editing and deleting:** none (R, simplest, matches the IR), delete only, or both?
5. **Read receipts and typing indicators:** skip (R), or read receipts only?
6. **Attachments in chat:** note cards only (FR7) (R), or images too (reuses the R22 upload pipeline later)?
7. **Group size limit:** 30 members (R)? Who can add members: any member (R) or the creator only?
8. **Message history paging:** 50 per page with keyset paging (R, same helper as R25).
9. **Notification retention:** keep 90 days like interactions (R), or forever?
10. **Email notifications:** none (R; in-app only), or a daily digest?
11. **Blocking users:** out of scope (R; reporting exists), or add a simple block list?
12. **Order of work:** search first (no Socket.io dependency, carries NFR1), then Socket.io and messaging, then R8 (R).
