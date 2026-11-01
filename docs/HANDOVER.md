# Handover — 1 Nov 2026 (Sprint 6 Stabilise closed; next: Sprint 7 R28)

Read with `PLAN.md` (milestones, official dates), `sprints/sprint6_review_retrospective.md` and `adr/` (0085 on).

## State of `main`
- Sprint 6 merged 28-29 Oct (14 issues, milestone closed): #70 CLI-TC40 · #71 mattpocock setup and `GLOSSARY.md` ·
  #87 orchestrator workflow (ADR 0086) · #88 AI scope (ADR 0085) · #89 non-blocking audit job · #90 layout HTML escaping
  · #91 schema docs and drift check · #92 socket expiry (ADR 0088) · #94 R5 admin Modules · #95, #97, #99 idle limits
  (messaging, editor lock, video polling) · #100, #102 NFR3 check and re-weight (ADR 0089) · #103 10x latency (ADR 0090).
- Tests: shared 8, client 188, server 445 + 2 skipped; check and build green; 5/5 no-cache runs.
- This handover's PR (`docs/handover-1030`): records, ADRs 0091-0092, retro changes in `ship-feature`, `security-reviewer`
  and `conventions/agent-workflow.md`. The next orchestrator merges it first.

## User steps (exact)
1. Start the next orchestrator from `../run-logs/KICKOFF_next_session.md` (migration steps on the kickoff Artifact page).
2. Type `/to-spec docs/specs/R28_ai_assistant.md`, then `/to-tickets`, when the orchestrator asks (user-invoked).
3. Meeting #2 (week of 2 Nov): `OPEN_QUESTIONS.md` supervisor list; confirm the proposed UAT (30 Nov) and report
   (12 Dec) dates in `PLAN.md`.
4. Recruit UAT participants and label the relevance seed (#86).
5. Optional: delete the ~50 stale remote branches from before Sprint 6 (`git branch -r`; all merged or abandoned).

## Next work, in order
1. Sprint 7: R28 AI writing assistant (spec approved, D83), 4-6 tracer-bullet tickets from `/to-tickets`.
   Fold in ambition pick B3 (28 Oct) first: UAT-S2 timed with and without AI, target at most half the manual time.
2. Sprint 8: UI refresh (mid-Nov, after R28 slice 1), then R26 E2E (#81), UAT seed (#82), evidence pipeline (#83),
   UAT redesign (#84), all before 20 Nov; limitations write-up (#85) before UAT.
3. R41 only if time remains after R28; R35 and R36 are future work (ADR 0085).

## Issue proposals for the orchestrator (not yet filed; show the user the titles)
- chore: check in `vp run check` that `docs/chapter4/CHAPTER4.md` matches its sources (retro action 8; parallel PRs
  both rebuilt it).
- docs (report lane): fold the meeting #1 feedback into Chapters 2-3 (appraisal, survey analysis, APA, indentation,
  diagram paragraphs) — a writer session in `../FYP_Submissions`.
- docs (report lane): FR20+ numbers and justifications in `drafts/3.3.3.4_requirement_changes.md` (ADR 0092).

## Open for the user
- Floor FR1-FR18 or FR1-FR19: the IR .md stops at FR18; FR19 (lecturer approval) may be an addition. Check the .docx.
- `SafeHtml` branded type (#75 open item): needs a deck schema change; not done.
- Remote branch deletes stay manual: auto mode blocks `git push origin --delete` (user, 1 Nov).

## Known limits
- Keyword and Top search p95 ~740 ms at 10x (SRCH-TC23, ADR 0090; within NFR1's 3,000 ms).
- The D75 annotation cap race, view-collaborator annotations 404, marked race shortcuts (#85).
- Live deploy is optional and off (D82). Video is frozen (ADR 0091).
