# 0095 - Apple-neutral theme (UI refresh, #123, 1 Nov 2026)

- **Context:** the UI refresh needed one direction for the client's tokens. The old theme used ink blue, a yellow
  highlighter for lecturer validation, and Plus Jakarta Sans.
- **Decision (user):** Apple-neutral: one blue accent (#0066cc light, #2997ff dark) for actions and focus, grey text,
  soft surfaces, dark background #1c1c1e, Inter for the UI. The highlighter goes. "Verified by" is a neutral `surface`
  pill with a check icon, with only the word "Verified" in Doto (OFL), never under 13 px. Slide and deck colours and
  fonts stay. Inter and Doto are self-hosted from `@fontsource-variable` (#125).
  - Made while building, under the user's "keep every pair at or above the limit": dark `primary-foreground` is dark
    text (white on #2997ff is under 4.5:1 (about 3.0:1)); muted is #68686d, the light input border #86868b and dark destructive #ff5b52,
    because the proposed values missed a limit; "Verified" is 15 px at weight 900, because 13 px washed out on a 1x
    screen. The Super Like state moved from `highlight` to `primary`. Dark `accent` is #323234 so hover shows on `surface`; that puts `primary` on it at 4.24:1, so `primary` on `accent` is icons only.
- **Alternatives:** #0071e3 for the accent (4.7:1 on white, less margin than #0066cc). Pure black for the dark
  background (the user chose #1c1c1e). Inter semibold only for "Verified" (the brief's fallback if Doto were illegible).
- **Reversibility:** High. Colours and fonts are tokens in `client/src/index.css`; the pill is one component.
- **Tests:** UI-TC1 to UI-TC3 (`docs/testing/theme_2026-11-01.md`).
