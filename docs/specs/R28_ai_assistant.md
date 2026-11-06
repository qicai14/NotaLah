# R28 AI writing assistant: spec

Status: **approved 25 Oct 2026 (D83).** Answers to the open questions are recorded at the end. Decisions it builds on: D33 (assistant agreed 15 Oct), D57 (cost guard), D69 (themes and layouts shared with
R28), D74 (free tier only). R35 (photo import) and R36 (dictation) reuse the outline pipeline below (now future work, ADR 0085).

## Goal
Help a student turn rough material into a clean slide note faster, without touching the feed. Traceability: R28 ·
addition, FR number to be assigned in #107 (ADR 0085, ADR 0092) · supports FR8 and Objective 3. The feed's
ranking stays the deterministic heuristic (NFR3). AI output is always an editable draft, never published by itself.

## Features (slice 1)
1. **Tidy into slides:** paste messy text (lecture notes, chat summary) → a draft deck in the note's current theme
   and aspect. Appends slides after the active one; one undo step removes them.
2. **Import a file → draft deck:** `.txt`, `.md`, `.docx`, `.pdf` text is extracted, then goes through (1).
   (`.pptx` deferred, see question 2.)
3. **Text-box actions** on the selected text box: Rewrite clearer, Shorten, Quiz me (adds a new slide with 3-5
   questions and the answers in the page notes).

## Design
- **Provider:** server-side only, OpenAI-compatible chat completions via `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`
  (Groq today; keys already in `.env`). No key → routes answer 404 and the client hides every AI control.
- **The model never writes slide JSON.** It returns a small outline that zod validates, with layouts `title`,
  `title-body`, `two-column` and `code`; the size limits are `OUTLINE_LIMITS` in `shared/src/limits.ts` (ADR 0093).
  The client turns each outline slide into real elements with `layoutSlide(layout, theme, aspect, newId)` from
  `shared/src/design.ts` and fills the text, so positions, fonts and colours come from our own code (D69) and the
  deck still passes `deckSchema`. Invalid output: one retry with the zod error, then a plain "Couldn't tidy this,
  try shorter text" message.
- **Text-box actions** return plain text only; the client puts it through the same sanitiser as typed text.
- **Server:** `server/src/features/ai/` (`routes.ts`, `service.ts`, `prompts.ts`, `config.ts`), endpoints
  `POST /api/ai/outline {text}` and `POST /api/ai/rewrite {text, action}`; signed-in users with an active account
  only (not guests). Input ≤ 8,000 characters (outline, #121) and ≤ 2,000 (rewrite). Request timeout 30 s; for the outline one deadline
  covers the first call and its retry, so no retry is sent after 30 s (#121).
- **File text extraction** in the browser (`.docx` via `mammoth`, `.pdf` via `pdfjs-dist`, `.txt/.md` native),
  lazy-loaded only when the import dialog opens, so the main bundle and the 0.1 CPU server are untouched. Files
  ≤ 5 MB; only the extracted text is sent.
- **Limits (D57 pattern):** per-user 20 AI calls a day; app-wide daily cap at 80% of the model's documented
  free-tier request and token limits (checked against Groq's current limits page at build time and recorded in the
  D-entry), through `consume('ai_requests', …)` and `consume('ai_tokens', …)` with the `day` period; 503 "AI help is
  resting until tomorrow" at the cap; `AI_DISABLED=true` kill switch; admin usage report lists both metrics.
  `createLimiter` adds a burst limit (5 a minute per user).
- **"AI-assisted" label (ADR 0094):** new nullable column `pst_ai_assisted_at TIMESTAMPTZ` (migration). Every
  outline and rewrite reply carries `aiToken`, a JWT for the requesting user (`sub`) with audience `ai-output`, valid
  24 hours and signed with its own key derived from `JWT_SECRET`, so it never works as a login cookie and a login
  token never works as it. The editor sends the token from its last AI reply with each save (`POST /api/notes`,
  `PUT /api/notes/:id`); a valid token whose `sub` is the saving Owner or Collaborator sets
  `pst_ai_assisted_at = COALESCE(pst_ai_assisted_at, NOW())` in the same write. No, invalid, expired or another
  user's token is ignored and the save still succeeds. Once set the label stays; no client action removes it. Notes
  and feed cards carry `aiAssisted`, shown as a small badge in the editor, on the Note and on the feed card. Not a
  ranking input.
- **Safety:** the system prompt treats user text as data; output is schema-checked and sanitised, never executed or
  rendered as HTML; no user identity, email or other notes go to the provider; the dialog tells users their text is
  sent to an external AI service. Logs record counts and latency, never the text.

## Tests (TC prefix AI-TC)
Schema rejects bad outlines; retry-then-fail path; caps and kill switch; guests and inactive accounts refused;
hidden without a key; label set only with a valid AI token for the saving user; client builds a valid deck from every layout; sanitiser
on rewrite output. Provider mocked through an injectable `fetch` (as R2 does).

## Acceptance (B3)
R28 is judged by time saved. UAT-S2 is timed with and without the AI; the target is at most half the manual time. Automated tests use a stubbed provider (no key or network). This also feeds the UAT redesign (#84).

## Report impact
Chapter 1.6 scope and Chapter 2 AI paragraph (already flagged in D33 and supervisor question 6); Chapter 4 adds a
use case (UC24 Use AI Assistant) and a Mermaid sequence diagram; Chapter 6 notes the free-tier limits.

## Decisions (user, 25 Oct, D83)
1. Per-user limit: 20 AI calls a day.
2. Import: `.txt`, `.md`, `.docx`, `.pdf` in slice 1; `.pptx` later (PLAN R41).
3. Quiz me: a new slide with 3-5 questions, answers in its page notes.
4. Label: stays once AI output is accepted; the author cannot remove it.
5. Order: build now, alongside the meeting #2 report work.
