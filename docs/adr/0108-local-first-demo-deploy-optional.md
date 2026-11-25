# 0108 - The local stack is the demo; live deployment is optional (D82, D74, D77, #152, 26 Nov 2026)

- **Context:** deployment is not in the marking scheme; the demo and the submission must work on one laptop without
  accounts or keys.
- **Decision:** `vp run db:up` (Docker Postgres) and `vp run dev` run the whole system, and the E2E suite and CI run
  against local databases and an AI stub. A live path exists but is switched off until the owner creates the accounts:
  Render for the API image, a Cloudflare Pages Function proxying `/api` and `/socket.io` so the browser sees one origin
  (D74), and GitHub Actions running migrate, then the Render hook, then the Pages deploy (D77). Deploy work must never
  change local behaviour, add a required local env value or block marked work.
- **Alternatives:** separate `app.` and `api.` domains (needs one registrable
  domain for the SameSite cookie, D66).
- **Reversibility:** High.
- **Tests:** E2E suite (`vp run test:e2e`); load evidence in `docs/testing/`.
