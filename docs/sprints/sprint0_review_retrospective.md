# Sprint 0 (Design) — Review and Retrospective

*Sprint dates: 13–19 October 2026 (planned). Increment completed: 13 October 2026.*

## Sprint goal

	Produce the complete Chapter 4 design of PARP, consisting of use case, class, activity and sequence models, database design, interface wireframes and prepared test cases, so that the four implementation sprints start from an agreed specification and a fixed definition of done.

## Sprint review

### Increment delivered

| Deliverable | Location | Status |
| --- | --- | --- |
| Use case diagram and 22 use case specifications | `docs/chapter4/4.2.1_use_cases.md` | Done |
| Class diagram | `docs/chapter4/4.2.3_class_activity_sequence.md` | Done |
| Activity diagrams (5): publish, ranked feed, lecturer verification, search, post-anchored messaging | same file | Done |
| Sequence diagrams (5) for the same workflows | same file | Done |
| ERD (19 tables) and schema table (105 fields), rendered as images | `docs/chapter4/4.3_database_design.md` | Done |
| Initial schema as a versioned migration, verified up and down on PostgreSQL 17 | `server/db/migrations/20261013000001_initial_schema.sql` | Done |
| 25 low-fidelity wireframes with descriptions | `docs/chapter4/4.4_interface_design.md` | Done |
| Unit test cases (8 modules × 10) and UAT instruments | `docs/chapter4/4.5_test_cases.md` | Done |
| Assembled, numbered Chapter 4 draft | `docs/chapter4/CHAPTER4.md` | Done |

	All diagram sources are kept as PlantUML text beside their rendered images, and the wireframes and schema images are generated from scripts, so any change requested at the next supervisor meeting can be applied and re-rendered consistently rather than redrawn.

### Requirement coverage

	Table S0.1 traces every functional requirement from the Investigation Report to the use case that specifies it and the sprint that will implement it. Every high-priority requirement is covered by at least one use case and one module of test cases.

*Table S0.1: Functional requirement traceability after Sprint 0*

| FR | Priority | Design outcome | Use case(s) | Test module | Sprint |
| --- | --- | --- | --- | --- | --- |
| FR1 | High | Kept | UC19, UC22 | VER, ADM | 3 |
| FR2 | High | Kept | UC07, UC19 | VER | 3 |
| FR3 | High | Kept | UC09 | RANK | 3 |
| FR4 | High | Kept | UC14 | SRCH | 4 |
| FR5 | High | Kept | UC14 | SRCH-TC10 | 4 |
| FR6 | High | Kept | UC15, UC16 | MSG | 4 |
| FR7 | High | Kept | UC15, UC17 | MSG | 4 |
| FR8 | High | Kept | UC05, UC08 | NOTE | 2 |
| FR9 | High | Kept (architectural) | UC05–UC18 | all | 1–4 |
| FR10 | Medium | Kept | UC06, UC07 | NOTE | 2 |
| FR11 | Medium | Kept | UC09 | RANK | 2 |
| FR12 | Medium | Kept | UC14 | SRCH | 4 |
| FR13 | Medium | Kept | UC18 | MSG | 4 |
| FR14 | Medium | Kept | UC13 | ENG | 2 |
| FR15 | Medium | Reworked: lecturer and date-range filters | UC14 | SRCH | 4 |
| FR16 | Low | Kept as one-level comment replies | UC11 | ENG | 2 |
| FR17 | Low | Cut to future work | — | — | — |
| FR18 | Low | Cut; covered by slide-referenced, pinned lecturer comments | UC11 | ENG | 2 |

### Scope changes and justification

	Four low-priority requirements were reviewed against the compressed schedule, as agreed with the supervisor on 9 October 2026. Bookmarking (FR14) was kept because it directly serves the consolidation objective and costs one table. Filtering by lecturer and academic term (FR15) was reworked into a lecturer-content filter and a published-date range, because academic terms differ between programmes and modelling them would require a term calendar that no one maintains, whereas a date range expresses the same need. Background audio (FR17) was cut to future work: it had the weakest support of any proposed feature, with 53.1 percent rating it useful and 18.8 percent rating it below moderately useful, and it would require an upload, storage and copyright-moderation pipeline that contributes to none of the four objectives. Peer annotation (FR18) was cut because it was proposed by a single respondent and its underlying need, lecturer feedback on a specific part of a note, is met by comments that reference a slide number and by automatic pinning of lecturer comments.

	Two elements were added during design. Administrator approval of lecturer accounts (UC22) was added because, without it, any user could select the lecturer role and verify their own notes, which would invalidate the lecturer validation component that carries the joint-highest weight in the ranking formula. A seeded module catalogue was added so that subject and programme search (FR4) operates on consistent values rather than free text.

## Sprint retrospective

### What went well

- Designing the database before the class diagram meant the class, ERD and sequence diagrams use the same names and relationships, and the schema was validated against a running PostgreSQL instance on the same day rather than at the start of implementation.
- Writing the test cases before code turned each use case's exception flows into concrete expected outcomes, for example the 403 response for a student calling the verification endpoint, which removes ambiguity from Sprint 1 onward.
- Keeping diagrams as text sources made iteration cheap; layout problems found on review, such as an action drawn in the wrong swimlane, were corrected and re-rendered in minutes.

### What did not go well

- The project entered Part II approximately three weeks behind the Investigation Report schedule: the IR Gantt chart placed the end of Sprint 2 on 18 October, but no design or code existed on 13 October.
- The ranking formula in the Investigation Report markdown copy had lost its equation images, so the engagement formula had to be recovered from the original document before it could be specified in the activity diagram and test cases. Formulas are now written as text in the design documents.
- The entity relationship diagram is wide, because nineteen entities with a highly connected USER_T table do not fit a portrait page; it will need a landscape page in the final report.

### Change of sprint length from two weeks to one week

	The Investigation Report planned four implementation sprints of two weeks each. To recover the three-week delay without moving the submission date, which is assumed to be around 29 November 2026, the remaining work is re-planned as this one-week design sprint followed by four one-week implementation sprints and a two-week finalisation period for user acceptance testing and Chapters 5 and 6. The Scrum Guide requires only that sprints are of consistent length and no longer than one month, and notes that shorter sprints generate more learning cycles and limit risk (Schwaber & Sutherland, 2020); the change is therefore made once, at a sprint boundary, and the new length is kept for all remaining sprints. Three project conditions make the shorter cycle feasible. First, the developer is the whole Scrum team, so no coordination time is lost in shortening the cycle. Second, implementation is assisted by an AI coding assistant working from the specifications produced in this sprint, which shortens the time from a specified use case to working code while leaving design, review and acceptance decisions with the developer. Third, the submission date is fixed, so the scope of each sprint, rather than its length, is the variable that must absorb further delay; the cut and reworked requirements above are the first application of that rule.

	The risk of the change is that a one-week sprint leaves little slack for defects, so the definition of done for each sprint is that its prepared test cases pass, the work is committed to version control, and the plan is updated. Any test case that cannot pass within its sprint is carried into the next sprint's backlog explicitly rather than hidden.

### Actions for Sprint 1

1. Build the multi-tier skeleton (React client, Express API, PostgreSQL in Docker Compose) and apply the Sprint 0 migration through the migration tool, not by hand.
2. Implement registration, login and role enforcement, and automate test cases AUTH-TC1 to AUTH-TC10 with their identifiers in the test names.
3. Confirm the open administrative items (Form 421, PG Bank log of meeting 1, booking of meeting 2) and the final submission date.
4. Present the Chapter 4 draft and the scope changes for FR14, FR15, FR17 and FR18 at supervisor meeting 2 for approval.

*Reference to add to the report's reference list:* Schwaber, K., & Sutherland, J. (2020). *The Scrum Guide*. Scrum.org. https://scrumguides.org/scrum-guide.html
