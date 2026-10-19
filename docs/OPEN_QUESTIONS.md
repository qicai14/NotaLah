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
   `app.<domain>`, Express + Socket.io on Fly.io at `api.<domain>`, Neon Postgres, the free GitHub Student Pack
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
5. Confirm the exact final submission date.
