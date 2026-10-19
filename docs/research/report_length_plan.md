# Report length plan (for supervisor meeting #2)

Measured 15 Oct 2026 by the writer agent on the committed report (`FYP_Submissions`, commit 5ba41ef).

**Counting method:** python-docx, body paragraphs from the "Chapter 1" heading to "References"; excludes headings,
Caption-style paragraphs, empty paragraphs and everything inside tables (use case specs, test tables, cross-tabs);
includes list items; a word is a whitespace-separated token (Word's counter reads slightly higher).

| Chapter | Now | Target |
|---|---|---|
| 1 Introduction | 2,962 | 2,000 |
| 2 Literature Review | 15,421 | 6,700 |
| 3 Methodology | 11,676 | 4,850 |
| 4 Design | 6,997 | 5,050 |
| **Ch 1-4** | **37,056** | **18,600** |
| 5-6 (placeholders now) | 109 | 6,000-7,000 |
| **Ch 1-6** | | **about 25,000** |

**Ask at the meeting:** the brief's standard is 18,000-20,000 words excluding appendices; 25,000 for Chapters 1-6 is
above it. Confirm which limit applies before cutting.

## Section plan
Keep = leave; Condense = rewrite shorter; Move = detail to an appendix with a summary and cross-reference; Expand = add.

| Section | Now | Proposed | Action | Rationale |
|---|---|---|---|---|
| 1.1 Introduction | 289 | 220 | Condense | Repeats the abstract's framing |
| 1.2 Problem Background | 700 | 480 | Condense | Keep the three problems and figures; 1.2.5 mapping becomes a table |
| 1.3-1.4 Aim, Objectives | 169 | 170 | Keep | Marked against these |
| 1.5 Scope | 412 | 330 | Condense | Remove repetition of 1.6.4 |
| 1.6 Potential Benefits | 731 | 450 | Condense | 1.6.4 Deliverables repeats 1.5 |
| 1.7 Overview of the Report | 271 | 110 | Condense | One sentence per chapter |
| 1.8 Project Plan | 390 | 240 | Condense | Gantt carries the detail |
| 2.1.1 Problem Domain | 2,058 | 900 | Condense | One source per claim |
| 2.1.2 Algorithm Domain | 1,562 | 700 | Condense | Keep the comparison of ranking approaches |
| 2.1.3 Methodology Domain | 759 | 350 | Condense | Overlaps 3.1.2 |
| 2.2 Similar Systems | 2,320 | 900 | Condense | ~300 each: purpose, one strength, one limitation, design lesson |
| 2.2.5 Conclusion | 308 | 300 | Keep | The gap is argued here |
| 2.3.1 Requirement Analysis | 362 | 200 | Condense | |
| 2.3.2 Programming Language | 1,916 | 450 | Condense + Move | Comparison table and decision stay |
| 2.3.3 DBMS | 1,179 | 300 | Condense + Move | As 2.3.2 |
| 2.3.4 Ranking Algorithm Design | 1,644 | 950 | Condense | Core; keep formula, weights, worked example |
| 2.3.5 IDE | 413 | 100 | Condense | Low marking weight |
| 2.3.6 Tools and Libraries | 1,053 | 300 | Move | Library list to an appendix table |
| 2.3.7-2.3.10 OS, hosting, stack | ~840 | 300 | Condense | Merge into one "deployment stack" section (now live deployment, D29) |
| 2.3.11 Appraisal of Technological Implications | 182 | 600 | **Expand** | Supervisor feedback: scalability, JWT/real-time security, cost and lock-in, maintainability, ranking ethics, AI assistant (D33) |
| 2.4 SDG Mapping | 410 | 300 | Condense | |
| 3.1.1 + intro | 148 | 150 | Keep | |
| 3.1.2 Methodology Comparison | 1,581 | 550 | Condense + Move | Table and Scrum vs next-best stay |
| 3.1.3 Choice and Justification | 645 | 400 | Condense | |
| 3.1.4 Activities per Scrum Phase | 2,580 | 800 | Condense | Keep only this project's sprints, artefacts, ceremonies |
| 3.1.5 Plan of the Project | 1,077 | 250 | Move | Sprint table and Gantt to an appendix |
| 3.2.1 Data Gathering Method | 478 | 250 | Condense | |
| 3.2.2 Design of Questions | 702 | 300 | Condense + Move | Questionnaire is appendix material |
| 3.3.1 Analysis of Survey Responses | 3,400 | 1,400 | Move + Keep | See below |
| 3.3.2 Summary of Findings | 598 | 350 | Condense | |
| 3.3.3 User Requirements | 467 | 400 | Keep | Links findings to FRs |
| 4.1 Introduction | 250 | 150 | Condense | |
| 4.2.1 Use Case Diagram | 461 | 250 | Condense | Keep the paragraph under the diagram |
| 4.2.2 Use Case Specifications | 1,162 | 550 | Condense | Tables stay |
| 4.2.3 Class Diagram | 354 | 300 | Keep | |
| 4.2.4 Activity Diagrams | 730 | 330 | Condense | |
| 4.2.5 Sequence Diagrams | 650 | 270 | Condense | |
| 4.3 Database Design | 672 | 400 | Condense | Schema table carries the detail |
| 4.4 Interface Design | 1,454 | 2,200 | **Expand** | 40 v2 screens at 3-5 lines each |
| 4.5 Test Case Preparation | 1,088 | 500 | Condense | Tables carry the detail |
| 4.6 Summary | 176 | 100 | Condense | |

**Survey analysis (3.3.1), honouring "more detailed analysis":** move the 34 single-question charts (Figures 50-83),
Tables 22-23 (open responses), the Spearman matrix (Table 30) and the less decisive cross-tabs (Tables 26, 29) to an
appendix. Keep in the body (~1,400 words): a one-page respondent profile, the design-driving cross-tabs (Tables 24, 25,
27, 28) each explaining why the pattern appears and which FR it supports, and one paragraph on the two or three
Spearman correlations that matter. Explanatory paragraphs under every remaining figure stay; cuts come from surrounding prose.

## Chapter 4 changes once wireframes v2 are approved (not done)
1. Restructure 4.4 into six subsections (account 3, feed and note 7, slide editor 9, profile/search/saved 10,
   notifications and messaging 7, administration 4); replace the figures with the 40 PNGs; trim the branch's ~3,100-word
   4.4 text to ~2,200.
2. Renumber later figures; regenerate the List of Figures and TOC.
3. Check 4.2.1-4.2.2 use cases cover every new screen function (editor templates/photos/music/drafts, Super Like,
   notifications, message requests, group chat, admin lecturer applications and modules); add use cases or log extras.
4. Check the class diagram and ERD for implied entities (FOLLOW_T, NOTIFICATION_T, ANNOTATION_T, TERM_T, ASSET_T,
   editor element model, audio and aspect columns).
5. Extend UAT preparation (4.5.3) to the new screens.
6. Update 4.1 and 4.6 for the v2 design direction; plan Chapter 5 screenshots in wireframe order.
