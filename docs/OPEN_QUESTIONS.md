# Open questions (only the user can answer)

Reviewed with the user on 14 Oct 2026. Answers are recorded under each question; still-open items are marked **OPEN**.

1. Final submission date? **Answered:** around end of December 2026 to early January 2027, not 29 Nov. Exact date
   still to confirm at the final briefing (week of 9 Nov). PLAN.md re-planned: same build pace, an extra Sprint 5,
   UAT on the live site, December for the report and buffer.
2. Has Form 421 been emailed to the supervisor? **Answered:** yes.
3. Has supervisor meeting #1 (9 Oct) been logged on PG Bank? **OPEN:** not yet; to-do in PLAN.md Admin row.
4. Meeting #2 booked? **OPEN:** not yet; to-do in PLAN.md Admin row (target ~28 Oct).
5. Lecturer sign-up: an APU staff email domain? **Answered:** unknown; admin approval alone (D6) stands.
6. Stray folder C:/Users/reymy/Code%20Projects. **Closed:** deleted by the user.
7. Report length (questions 7, 9 and 11 merged): Chapters 1-4 hold about 39k words of prose against an 18-20k
   standard, before Chapters 5-6. **Answered:** the writer drafts a cut plan (target about 25k words of prose: condense
   Chapter 2 literature and similar systems to about 8k and keep the new appraisal sections; move the survey
   cross-tabulation tables and Spearman detail to an appendix with a one-page summary in Chapter 3; Chapters 4-6 as
   they are). No cuts until the user and the supervisor agree at meeting #2.
8. Final demonstration hosting? **Answered:** live deployment with CI/CD (D29): Cloudflare Pages frontend on
   `app.<domain>`, Express + Socket.io on a Render free web service at `api.<domain>` (user, 18 Oct; Fly.io dropped, D65), Neon Postgres, the free GitHub Student Pack
   `.me` domain, GitHub Actions pipeline. Local hosting stays as the fallback. Report §1.5 and §2.3.9 to be updated.
   **Updated 20 Oct (D65):** the API moves from Fly.io to one Render free web service at `api.<domain>`; the rest stands.
9. (Merged into 7.)
10. References (researcher check, 14 Oct):
    - Lieu (2024): confirmed. *A structured approach to online discussion* [Doctoral dissertation, Royal Holloway,
      University of London]. Royal Holloway Research Portal.
      https://pure.royalholloway.ac.uk/en/publications/a-structured-approach-to-online-discussion/
    - Shahzad et al. (2023): confirmed via Crossref. *Sustainability, 15*(1), Article 5 (was 15(5)).
      https://doi.org/10.3390/su15010005
    - Gusenbauer (2024), details from the user (via NotebookLM; Google Scholar incomplete):
      Gusenbauer, C. P. (2024). *Assessment of the risks of fake user-generated content and corresponding
      countermeasures* [Master's thesis, Johannes Kepler University Linz]. JKU ePUB. Add the repository URL if found.
    - Gufroni & Zaman (2026), details from the user: no journal, DOI or URL is printed on the PDF, so cite it as an
      unpublished manuscript (APA 7 uses the year only):
      Gufroni, M. S. I., & Zaman, S. (2026). *Evaluating the effectiveness of Notion as a project management platform
      in academic environments* [Unpublished manuscript]. Program Studi Teknik Informatika, Fakultas Sains dan
      Teknologi, Universitas Islam Negeri Maulana Malik Ibrahim Malang. If the user finds where it was downloaded
      (repository, preprint server), add that URL.
    - **Closed:** the writer applies all four entries (PLAN R15). Not independently verified by the researcher.
11. (Merged into 7.)

## To ask the supervisor at meeting #2 (~28 Oct)
1. Report length: Chapters 1-4 hold about 39k words of prose against the 18-20k standard. Approve the cut plan (question 7)?
2. Wireframes (4.4): the UI is being redesigned (TikTok-style layout). Must Chapter 4.4 wireframes match the final
   product, or may the 25 wireframes stay as the pre-coding design with differences explained in Chapter 5?
3. Is a clickable prototype expected, or are the 25 wireframes sufficient?
4. FR changes: confirm the requirement additions (FR19 lecturer approval, follows/friends, notifications, live deployment).
5. Restored FR15/FR17/FR18 and the additions beyond the IR (collaboration, guest browsing, blocking, Canva-style editor,
   video, cost guard): number them FR20 onward in Table 33, or list them as enhancements without FR numbers?
6. Optional AI aids (R28 writing assistant, R35 photo/handwriting import, R36 dictation) reverse the IR's AI exclusion
   while the ranking stays heuristic: acceptable as a logged extension? **Updated 29 Oct:** R35 and R36 now move to
   future work (ADR 0085); see item 8.
7. The R13 report-sync drafts add about 3,800 words; fold them into the length cut plan (question 1)?
8. Confirm the AI addition (R28 and R41 in scope; R35 and R36 to future work) as overdelivery beyond the IR 1.5 Scope.
   User decision 29 Oct; ADR 0085; nothing waits on it.
9. Confirm the exact final submission date.

## Open for the user (20 Oct)
- FR numbering for the additions (supervisor question 5) decides the Table 33 wording in the R13 drafts.
- FR8 survey figure: the report says 19 selections (59.4%), the IR says 20 (62%); confirm which is correct.

## Answered 25 Oct (D83) — was: open for the user (22 Oct autopilot run)
- R28 spec (`docs/specs/R28_ai_assistant.md`): approve, and answer its five questions (daily limit 20, .pptx now or
  later, quiz-me form, AI label removable, build before or after the meeting #2 report work).
- R20 S5: may a restricted account still edit its display name and bio? Unchanged for now (D81).
- R10 share links: annotations show on a shared link only for public notes; a contacts-only note shared by link shows
  none (D79). Alternative: show them, since the link is the grant.
- R14: Plan A (~25.6k words, also condenses Ch 3 and trims Ch 4, beyond "Ch 4-6 as they are") or Plan B (~20k)?
  Chapter 2 → 8k was read as the whole chapter (`../FYP_Submissions/drafts/R14_cut_plan.md`).
- Render auth burst 20/min per IP and bcrypt 10 for production (D81): fine for UAT, or keep 60 and 12?

## Answered 29 Oct (glossary grill)
- Rename the code's `Module` naming (`MODULE_T`, `mod_*`, `pst_mod_id`) to Subject? **ANSWERED (user, 29 Oct): keep Module.** Subject now means a post's hashtags. Options considered. For: code
  matches the glossary and the UI term. Against: a migration plus changes in server, client and tests, and
  the dissertation's Chapter 4 schema names (`MODULE_T`) would need to change too. Not needed for the demo; Module is the canonical term in the glossary, UI and code.

## Open for the user (29 Oct, issue #79)
- Idle tabs: since ADR 0088 an open tab with messaging renews its own cookie, so an unattended signed-in tab stays
  signed in up to the 12 h `MAX_SESSION_HOURS` cap. **OPEN:** keep that, or add an idle limit (for example skip the
  renewal after about 50 minutes with no pointer or key activity, so an unattended tab logs out after about an hour)?
