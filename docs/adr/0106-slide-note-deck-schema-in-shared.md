# 0106 - Slide notes as a zod-validated element schema shared by client and server (D31, D53, #152, 26 Nov 2026)

- **Context:** notes are slide decks edited in a Canva-style editor; the server must trust nothing the client sends, and
  the editor and the viewer must agree on what a deck is.
- **Decision:** the `shared/` package holds the zod deck schema (text, shape, line, image, code, video, table
  elements), board geometry and limit constants, built once and used by both sides. The server validates every save
  against it, sanitises text with `sanitize-html`, enforces per-slide limits, stores each slide as JSONB (`sld_doc`) and
  builds the search document from the text content. The author chooses the slide size.
- **Alternatives:** HTML per slide (the Sprint 1 form; hard to validate and to search); separate client and server types
  (drift).
- **Reversibility:** Medium; additive element types fit the JSONB column, a different model means a content migration.
- **Tests:** notes API and editor test series; `shared/src/outline.test.ts`.
