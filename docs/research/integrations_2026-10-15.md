# Integration notes (researcher, checked 2026-10-15)

Several official pages were unreachable (Deezer developer pages, some Fly docs); items marked UNVERIFIED rely on
third-party sources. Re-check live consoles before citing figures in the dissertation.

## 1. Deezer API (UNVERIFIED against official docs)
- Calls: `GET https://api.deezer.com/search?q=...`, `GET https://api.deezer.com/track/{id}`; `data[].preview` is a 30 s MP3 URL.
- Auth: none. Limits (third-party): about 50 requests per 5 s per IP.
- Signed/expiring preview URLs: unverified. CORS: assume none, proxy through Express.
- **Terms (developers.deezer.com/termsofuse):** use "strictly limited for a non-commercial purpose"; use of the Content
  "limited to a strictly private use within a family scope"; previews only up to 30 s; local/offline storage of audio
  forbidden. **Risk:** a public demo streaming previews may fall outside "private, family scope". Needs a user decision.

## 2. Unsplash API
- `GET https://api.unsplash.com/search/photos?query=&page=&per_page=`, header `Authorization: Client-ID <key>`. Env: `UNSPLASH_ACCESS_KEY`.
- Demo 50 requests/hour; production 1,000/hour after applying in the dashboard.
- Must hotlink `photo.urls.*` (do not copy into R2); call `links.download_location` when a photo is used; credit "photographer and Unsplash".

## 3. Cloudflare R2
- `@aws-sdk/client-s3`, endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`.
- Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`.
- Free tier: 10 GB-month storage, 1M Class A and 10M Class B ops per month, free egress.
- Presigned GET/HEAD/PUT/DELETE (no POST form uploads), expiry 1 s to 7 days; single PUT up to 5 GiB; set our own caps.
- CORS for browser PUT: allow the Pages origin, methods PUT/GET, header Content-Type.
- Validation (suggestion, not researched): magic bytes with `file-type`, re-encode images with `sharp`, read MP4 duration from the `mvhd` box.

## 4. AI provider (OpenAI-compatible)
- Groq: `https://api.groq.com/openai/v1`; docs table lists `openai/gpt-oss-120b`, `openai/gpt-oss-20b` at 30 RPM, 1K RPD,
  8K TPM (labelled Developer plan; confirm free numbers in the console). Training terms not found.
- Gemini: `https://generativelanguage.googleapis.com/v1beta/openai/`; free-tier prompts may be used to improve Google
  products with human review (third-party summary). Avoid for students' notes.
- OpenRouter: `https://openrouter.ai/api/v1`; free models 20 RPM, 50 RPD under $10 lifetime credit (else 1,000);
  `provider: { data_collection: "deny" }` excludes training-eligible hosts; free ids end in `:free`.
- Structured-output support not verified for any provider.

## 5. Socket.io with Postgres
- `@socket.io/postgres-adapter`, `createAdapter(pool)`; table `socket_io_attachments` for large payloads.
- Neon's pooler (PgBouncer transaction mode) drops LISTEN/NOTIFY: the adapter needs the direct URL (`DATABASE_DIRECT_URL`).
- Multi-node needs sticky sessions when long-polling is on; or use `transports: ["websocket"]` only. Fly specifics unverified.

## 6. Shared rate-limit store in Postgres
- express-rate-limit current v8.6.2. `@acpr/rate-limit-postgresql` 1.4.1 looks unmaintained (~3 years);
  `express-rate-limit/rate-limit-postgresql` exists in the org; maturity unverified.
- Alternative with no dependency: a small `"RATE_LIMIT_T"` table and an UPSERT-based store implementing the
  express-rate-limit Store interface (orchestrator's note, not researched).

## 7. Parsing imported notes
- .docx: `mammoth` 1.13.0 (`extractRawText`). Check it is over two weeks old before pinning.
- .pdf: `pdf-parse` 2.4.5 (simple) or `pdfjs-dist` (low-level, frequent releases).
- .pptx: no standard; `office-text-extractor` 4.0.0 (ESM-only) or unzip the XML ourselves.

## Env vars to add later
`UNSPLASH_ACCESS_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`,
`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (D33, provider-agnostic instead of one key per provider), `DATABASE_DIRECT_URL`.

## Sources
- https://developers.cloudflare.com/r2/pricing/ · https://developers.cloudflare.com/r2/platform/limits/
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/ · https://developers.cloudflare.com/r2/buckets/cors/
- https://unsplash.com/documentation · https://unsplash.com/developers
- https://developers.deezer.com/termsofuse · https://developers.deezer.com/guidelines
- https://github.com/Socketio/socket.io-postgres-adapter · https://socket.io/docs/v4/using-multiple-nodes/
- https://neon.com/docs/connect/connection-pooling
- https://console.groq.com/docs/rate-limits · https://ai.google.dev/gemini-api/docs/openai · https://openrouter.ai/docs/faq
- https://github.com/express-rate-limit/rate-limit-postgresql · https://www.npmjs.com/package/@acpr/rate-limit-postgresql
