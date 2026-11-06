# Open questions (only the user can answer)

Reviewed with the user on 14 Oct 2026. Answers are recorded under each question; still-open items are marked **OPEN**.

1. Final submission date? **Answered (official timeline, 29 Oct):** Wed 16 Dec 2026 before 11:59 pm (document and
   source code); the presentation is from the week of 4 Jan 2027. UAT opens 23 Nov and finishes before 6 Dec (ADR 0098); the
   report by 12 Dec is proposed.
2. Has Form 421 been emailed to the supervisor? **Answered:** yes.
3. Has supervisor meeting #1 (9 Oct) been logged on PG Bank? **Answered (1 Nov):** yes.
4. Meeting #2 booked? **Answered (1 Nov):** booked for 5 or 6 Nov.
   **OPEN:** meeting #2 outcome not yet recorded (supervisor answers to the list below, Plan A or B, UAT window).
5. Lecturer sign-up: an APU staff email domain? **Answered:** unknown; admin approval alone (D6) stands.
6. Stray folder C:/Users/reymy/Code%20Projects. **Closed:** deleted by the user.
7. Report length (questions 7, 9 and 11 merged): Chapters 1-4 hold about 39k words of prose against an 18-20k
   standard, before Chapters 5-6. **Answered:** the writer drafts a cut plan (target about 25k words of prose: condense
   Chapter 2 literature and similar systems to about 8k and keep the new appraisal sections; move the survey
   cross-tabulation tables and Spearman detail to an appendix with a one-page summary in Chapter 3; Chapters 4-6 as
   they are). No cuts until the user and the supervisor agree at meeting #2.
8. Final demonstration hosting? **Answered (updated 1 Nov, D74, D82):** the demo and submission run locally. A live
   deploy is optional, unmarked and free hosting only; Fly.io is out and Render is the candidate API host. The earlier
   live deployment with CI/CD plan (D29, D65) is no longer required.
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

## To ask the supervisor at meeting #2 (5 or 6 Nov; outcome not yet recorded)
1. Report length: Chapters 1-4 hold about 39k words of prose against the 18-20k standard. Approve the cut plan (question 7)?
2. Wireframes (4.4): the UI is being redesigned (TikTok-style layout). Must Chapter 4.4 wireframes match the final
   product, or may the 25 wireframes stay as the pre-coding design with differences explained in Chapter 5?
3. Is a clickable prototype expected, or are the 25 wireframes sufficient?
4. FR changes: confirm the requirement additions (follows/friends, notifications). **FR19 lecturer approval closed (user, 1 Nov):** not in the IR .docx; it is the first addition, and the IR floor is FR1-FR18 (ADR 0092).
5. Restored FR15/FR17/FR18 and the additions beyond the IR (collaboration, guest browsing, blocking, Canva-style editor,
   video, cost guard): **user decision 29 Oct (ADR 0092):** FR20 onward (NFR numbers where non-functional), each with
   its justification (meeting #1, L36). Confirm with the supervisor.
6. Confirm the AI addition (R28 and R41 in scope; R35 and R36 to future work) as overdelivery beyond the IR 1.5 Scope.
   User decision 29 Oct; ADR 0085; nothing waits on it.

## Open for the user (6 Nov)
- Meeting #2 outcome: not yet recorded. Which of items 1-6 above did the supervisor answer, and Plan A or B?
- impeccable skill (restored in `FYP/.claude/skills`, helper agents in `FYP/.claude/agents`): keep it, or move it back
  to the archive?

## Open for the user (20 Oct)
- FR8 survey figure: the report says 19 selections (59.4%), the IR says 20 (62%); confirm which is correct.

## Answered 25 Oct (D83) — was: open for the user (22 Oct autopilot run)
- R28 spec (`docs/specs/R28_ai_assistant.md`): approve, and answer its five questions (daily limit 20, .pptx now or
  later, quiz-me form, AI label removable, build before or after the meeting #2 report work).
- R20 S5: may a restricted account still edit its display name and bio? Unchanged for now (D81).
- R10 share links: annotations show on a shared link only for public notes; a contacts-only note shared by link shows
  none (D79). Alternative: show them, since the link is the grant.
- R14: still for the supervisor (meeting #2): Plan A (~25.6k words, also condenses Ch 3 and trims Ch 4, beyond "Ch 4-6 as they are") or Plan B (~20k)?
  Chapter 2 → 8k was read as the whole chapter (`../FYP_Submissions/drafts/R14_cut_plan.md`).
- Render auth burst 20/min per IP and bcrypt 10 for production (D81): fine for UAT, or keep 60 and 12?

## Answered 29 Oct (glossary grill)
- Rename the code's `Module` naming (`MODULE_T`, `mod_*`, `pst_mod_id`) to Subject? **ANSWERED (user, 29 Oct): keep Module.** Subject now means a post's hashtags. Options considered. For: code
  matches the glossary and the UI term. Against: a migration plus changes in server, client and tests, and
  the dissertation's Chapter 4 schema names (`MODULE_T`) would need to change too. Not needed for the demo; Module is the canonical term in the glossary, UI and code.

## Answered 29 Oct (issue #79)
- Idle tabs: since ADR 0088 an open tab with messaging renews its own cookie, so an unattended signed-in tab stays
  signed in up to the 12 h `MAX_SESSION_HOURS` cap. **ANSWERED (user, 29 Oct): add an idle limit (#93).** Was: keep that, or add an idle limit (for example skip the
  renewal after about 50 minutes with no pointer or key activity, so an unattended tab logs out after about an hour)?
