# Working on NotaLah with AI agents (guide for Lim Qi Cai)

How the repo is set up for agentic work since 25 Oct 2026 (ADR 0084), how to start a session, and how to run the
mattpocock workflow step by step. Keep this file; new sessions are pointed here by `../../../run-logs/KICKOFF_next_session.md`.

## 1. What changed and what you need to know

- **Open every session in `C:\Users\reymy\Code Projects\FYP\FYP_Project`** (the git repo), not `FYP\`. All agent
  config is versioned here: `.claude\agents\`, `.claude\skills\`, `.claude\settings.json` (hooks, model `opusplan`).
  `FYP\` now only holds `FYP_Submissions\`, `FYP_Resources\`, `run-logs\` and an archive of retired skills
  (`FYP\.claude\skills-archive\`); sessions reach those through `additionalDirectories: [".."]`.
- **Instructions**: `AGENTS.md` (root, short) is read by Claude Code, Codex, Copilot and Antigravity. Each `CLAUDE.md`
  contains only `@AGENTS.md`. Detail lives in `docs\conventions\` and nested `AGENTS.md` files (`client\`,
  `server\`, `shared\`, `docs\`) and loads only when a task needs it. `vp run check` fails if they drift.
- **Rules you add**: only after an agent repeats a mistake, in the narrowest file (a nested `AGENTS.md` or a
  conventions file), never by asking an agent to "regenerate AGENTS.md".
- **Work items are GitHub issues.** One issue, one branch `<type>/<issue#>-<slug>`, one PR with `Closes #n`.
  `main` is protected (PR + green `verify` check; you can bypass as admin).
- **Decisions** go in `docs\adr\NNNN-title.md` (next is 0085). `docs\DECISIONS.md` (D1-D83) is history.
- **State**: `docs\HANDOVER.md` (what's true now, your steps), `docs\PLAN.md` (milestones),
  `docs\OPEN_QUESTIONS.md` (questions only you can answer).
- **Main model** is `opusplan`: Opus while planning (plan mode, Shift+Tab), Sonnet while executing. Subagents pick
  their own model (table below), so most work runs on Haiku or Sonnet.

| Agent | Model | Used for |
|---|---|---|
| `Explore` | haiku | finding code and files (read-only) |
| `scribe` | haiku | rewording, status and log edits, issue, PR and commit text |
| `researcher` | haiku | web and library-doc lookups |
| `tester` | haiku | `vp run check`, tests, build, E2E; reports results |
| `implementer` | sonnet (opus for auth, ranking, real-time) | server and logic issues |
| `frontend` | sonnet | UI issues on the design system |
| `reviewer` | sonnet | every PR |
| `security-reviewer` | opus | PRs touching auth, cookies, sharing, uploads, proxy, CI secrets |
| `writer` | sonnet (opus for the final .docx) | report drafts in `FYP_Submissions\drafts\` |

## 2. Starting a session

1. In the Claude desktop app, start a new Code session and choose the folder
   `C:\Users\reymy\Code Projects\FYP\FYP_Project`.
2. Paste the prompt from `FYP\run-logs\KICKOFF_next_session.md` (it points here and to `docs\HANDOVER.md`).
3. Ending a session: say "handover". The `handover` skill updates HANDOVER and PLAN, records decisions as ADRs, then
   asks you to type `/handoff` and saves the next kickoff prompt.

Other tools (Codex, Copilot, Antigravity): open the same folder; they read `AGENTS.md` on their own. Use them for
second-opinion reviews or one-off checks, on their own branch, never pushing to `main`.

## 3. The mattpocock workflow, step by step

These are slash commands **you** type (they are user-invoked only; Claude cannot start them for you). Do the one-time
setup once, then the per-feature loop for each piece of work.

### One-time setup (in this order)

**Step 1: `/setup-matt-pocock-skills`**
- What it does: records where issues live, the triage labels and where the glossary and ADRs live, in
  `docs\agents\*.md`, and adds an "Agent skills" block to the instructions.
- Answer: issue tracker **GitHub** (repo `qicai14/NotaLah`); triage labels **yes, keep the defaults**
  (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`); domain docs **single-context**
  (one `GLOSSARY.md` at the root, ADRs in `docs\adr\`).
- Watch for: it will want to edit `CLAUDE.md`. Tell it to put the block in `AGENTS.md` instead (our `CLAUDE.md` must
  stay exactly `@AGENTS.md`, or `vp run check` fails). It works on a branch and opens a PR like everything else.

**Step 2: `/grill-with-docs`**
- What it does: interviews you about the domain and writes `GLOSSARY.md` (and ADRs for decisions it uncovers).
- Give it a direction, e.g. `/grill-with-docs NotaLah's domain: notes, decks, slides, feed ranking (E/R/V/M), Super
  Like and lecturer verification, collaboration, share links, annotations, messaging`.
- Answer from what the app does today; say "not decided" rather than inventing. Expect 15-30 questions; you can stop
  and continue later. Terms it should capture: note vs deck vs slide, published/draft/contacts-only, Super Like,
  verified, interest vector, guest, friend (mutual follow), message request, share link roles, annotation.

**Step 3: `/to-spec` then `/to-tickets` for R28**
- `/to-spec docs/specs/R28_ai_assistant.md`: turns the approved R28 spec (and the conversation) into a spec issue on
  GitHub. It does not interview; if something is unclear it uses what is in the file.
- `/to-tickets <the spec issue number>`: splits it into tracer-bullet tickets (each a thin end-to-end slice: schema,
  API, UI, tests) with "blocked by" links, and asks you whether the granularity is right. Good answer for R28:
  roughly 4-6 tickets, e.g. outline endpoint + caps, client outline-to-slides, text-box actions, file import,
  AI-assisted label, quiz slide. Approve, and it publishes them as issues.
- Do the same later for R35, R36 and R41 (grill first: `/grilling` on the idea, then `/to-spec`, `/to-tickets`).
- Smaller known items (R5 admin Modules page, R26 E2E suite, flaky CLI-TC40) can be tickets straight away: ask the
  session "create GitHub issues for R5, R26 and CLI-TC40 using the triage labels".

**Step 4: `/improve-codebase-architecture`**
- What it does: scans recent hot spots for shallow modules, writes an HTML report to your temp folder (it opens it and
  prints the path) with candidate refactors, then asks which one to explore and grills you through it.
- Suggested direction: `/improve-codebase-architecture visibility and access rules across notes, share links,
  annotations and the feed, and the SQL fragments exported from server/src/features/notes/repository.ts`.
- Pick at most one candidate now; accepted ones become issues (`/to-tickets`). Run it again every few weeks.

### Per-feature loop (every piece of work)

1. Pick an issue (`gh issue list`, or ask "what's next?"; HANDOVER lists the order).
2. Say: "ship issue #N". The orchestrator runs the `ship-feature` skill: worktree + private test DB, the right builder
   (`implementer` / `frontend`), `reviewer` (+ `security-reviewer` when needed), `tester`, PR with `Closes #N`.
3. It asks before merging (unless you allowed merges for the session). Merging closes the issue.
4. A hard bug: `/diagnosing-bugs`. Test-first work: say "use /tdd" or type it.
5. End of a milestone: ask for "a thermo-nuclear review of the milestone" (reviewer + that skill), then `/retro`;
   `/code-review` on the range if you want a second opinion.

Unattended runs: say "autopilot until <time>" (the `autopilot` skill); it only takes issues labelled
`ready-for-agent` and logs decisions for you to review.

## 4. Saving usage on Claude Pro

- Let the orchestrator delegate: mechanical edits to `scribe`, searches to `Explore`, checks to `tester`.
- Plan in plan mode (Opus), then let execution run on Sonnet. Use `/compact` or a handover when context gets long.
- Every installed skill's name and description is sent with each request: uninstall plugins you don't use.
- Keep `AGENTS.md` short; put new rules in conventions or nested files.

## 5. Where to look

| Need | File |
|---|---|
| Current state and your next steps | `docs\HANDOVER.md` |
| Milestones and dates | `docs\PLAN.md` |
| Conventions | `docs\conventions\` |
| Decisions | `docs\adr\` (and `docs\DECISIONS.md` for D1-D83) |
| Agents and skills | `.claude\agents\`, `.claude\skills\` |
| Retired skills (restore by moving back) | `FYP\.claude\skills-archive\` |
