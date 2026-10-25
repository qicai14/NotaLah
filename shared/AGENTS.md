# shared (`@notalah/shared`)

- The zod deck schema (`deck.ts`), design data (`design.ts`: fonts, themes, layouts), geometry and limits used by both
  `client/` and `server/`. One source: never redefine these shapes or limits in either package.
- Consumers import the built `dist/` (`vp pack`); after a change run `vp run -r build` so both sides see it.
- Changing the deck schema changes stored notes: keep old decks valid (additive fields, defaults) or add a migration,
  and cover it with tests on both sides.
