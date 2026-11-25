# 0103 - Plain-SQL migrations with dbmate and quoted uppercase tables (D11, #152, 26 Nov 2026)

- **Context:** the dissertation shows the real SQL (Chapter 4.3 data dictionary, Chapter 5.2 snippets), and the APU
  marking rules fix the table naming.
- **Decision:** schema changes are only `.sql` files in `server/db/migrations/` with `-- migrate:up/down` sections, run
  by dbmate, which records applied versions in `schema_migrations`. Tables are UPPERCASE `_T`, double-quoted in SQL;
  columns are lowercase with a table prefix; SQL keywords are UPPERCASE. Schema docs are checked against the migrations
  by `scripts/check-schema-docs.mjs` in `vp run check`.
- **Alternatives:** node-pg-migrate (JS builders), Prisma or Knex (generate lowercase names and fight the quoted `_T`
  convention).
- **Reversibility:** Medium; every migration has a down step, but a switch of tool means rewriting the history.
- **Tests:** server tests run against a real `notalah_test` database migrated by `globalSetup`.
