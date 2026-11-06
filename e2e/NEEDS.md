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
