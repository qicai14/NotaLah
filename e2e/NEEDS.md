# Needs from the product or seed (not changed here)

- A2 needs three open note reports in the seed (#82 creates none). The hidden-note author must be Daniel Tan (student1)
  for the suspend step.
- Selectors guessed from source, never run: the publish dialog (public radio, module combobox, hashtag field, final
  Publish button), feed Like/Save/Comment buttons, the comment textbox and post button, the Message control on a
  profile, and the suspend reason field in /admin/users. Add accessible names or `data-testid` where a run fails.
- The "saved" text after Save draft is matched loosely; a stable `role="status"` message would help.
- S5 assumes the receiver's /messages list shows the pending request text before Accept.
- Mutating specs (S2 creates notes, A2 changes reports and users): re-seed a fresh database between runs.
- Run order and the shared `docs/testing/e2e-baseline.json` assume `workers: 1`.

## E2E-TC8 and the AI stub
- No product change needed: the API reads `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, so `playwright.config.ts` starts
  `e2e/stub-ai/server.mjs` (port 4010) and passes those to the dev server it starts. If you already run `vp run dev`
  yourself, restart it with the same three variables or the "Draft slides from text" button will not show.
- The stub answers outline requests only (Rewrite, Shorten and Quiz me are not covered).
- Guessed, never run: the Text rail button opens the panel (it toggles, so it fails if Text is already the default panel),
  and a new note starts with one slide.
