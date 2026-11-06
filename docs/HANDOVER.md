# Handover: 6 Nov 2026 (Sprint 7 R28 and Sprint 8 UI in progress)

Read with `PLAN.md` (milestones), `OPEN_QUESTIONS.md` and `adr/` (0091 on).

## State of `main` (056453a)
- Merged 1 Nov: #117 (#111 outline schema in `shared/`), #118 (#112 outline route, ADR 0093), #119 (#113 paste to
  draft), #126 (#114 Rewrite, Shorten, Quiz me), #124 (FR19+ numbering, R28 traced as an addition), #125 (Inter and
  Doto fonts), #120 (hosting note), #108, #109.
- Merged 6 Nov: #127 (Apple-neutral theme, ADR 0095, UI-TC1-3), closing #123.
- TC IDs: AI-TC1-40 used; AI-TC41-45 for #115, AI-TC46-55 for #116, AI-TC56-60 for #121. UI-TC1-3 used; UI-TC4-9 for #128.
- ADRs: 0094 reserved for #116, 0096 for #121, 0097 for #128. 0098-0099 in this PR. Next free: 0100.

## In progress 6 Nov (see the session or PR)
- #121 paste limit about 8,000 characters and one 30 s deadline (`fix/121-ai-deadline`, opus).
- #128 four axe violations (`fix/128-axe-landmarks`); it first retakes #127's dark screenshots and axe run.

## Next work, in order
1. #116 AI-assisted label as a signed token (opus; after #121 merges, as both touch `server/src/features/ai`; must
   include the audience/separate-key fix so an AI token can't be used as the login cookie).
2. #115 import .txt, .md, .docx, .pdf (after #121; never upload the file), then #122 B3 time-saved protocol (after #115).
3. #81 R26 E2E after #128. #82 UAT seed due 20 Nov. Also #83, #84, #85 (before UAT), #105.
4. Report lane (writer sessions in `../FYP_Submissions`): #107 FR19+ numbers, #106 meeting #1 feedback (before meeting #3).
5. After feature complete: `/improve-codebase-architecture`. R41 only if time remains.

## Owner decisions pending
- Meeting #2 (5 or 6 Nov): outcome not yet recorded. Log it on PG Bank and in `OPEN_QUESTIONS.md`.
- impeccable skill (restored in `FYP/.claude/skills`, helper agents in `FYP/.claude/agents`): keep or archive?
- Delete the 18 no-PR remote branches; all are merged into main. Command in
  `../run-logs/autopilot_2026-11-06/decisions.md`.
- Mascot: after #127, back to the "UI refresh advisor" session for the Gemini prompt (ADR 0099).
- #86: at least 3 UAT participants confirmed by 20 Nov (ADR 0098).

## Known limits and follow-ups
- Search p95 about 740 ms at 10x (ADR 0090). D75 cap race and view-collaborator 404 (#85). Video frozen (ADR 0091).
- Messaging socket and some client tests time out under machine load; run one heavy job at a time.
- EditorPage chunk about 517 kB; rewrite drops formatting; `ai_tokens:<userId>` rows never purged; reply lookup by
  Slide index can say "box is gone" after reordering; Login/Composer inputs have no visible border.
- Live deploy is unmarked and optional (D82): local-first demo, free hosting only.
