# NotaLah architecture (Mermaid)

State as of 22 Oct 2026 (main @ 69e331b), after the 20 Oct review fixes (D65-D68, D71, D74).
Dashed edges and `planned` nodes are not built yet (R11 deploy, R27, R28, R35, R36).
Paste each block into https://mermaid.live to render and style.

## 1. High-level architecture

```mermaid
flowchart TB
  subgraph Client["Browser: React 19 SPA (Vite+, Tailwind v4, shadcn/ui, zustand, TipTap)"]
    direction LR
    Feed[Feed + video player]
    Editor[Slide editor]
    Search[Search]
    Msg[Messages + notifications]
    Share[Sharing + collaboration]
    Prof[Profiles]
    Admin[Admin]
    Shared[["@notalah/shared<br/>zod deck schema + design data"]]
  end

  subgraph API["API: Express 5 + Socket.io (one Node process)"]
    direction TB
    MW["Middleware: pino request id → helmet → CSRF header → createLimiter (Postgres store) → JSON → passport-jwt (sliding session)"]
    subgraph Features["Feature modules"]
      direction LR
      Auth[auth · users]
      Notes["notes · assets<br/>noteAccess()"]
      Rank["feed + ranking<br/>E · R · V · M (heuristic, no ML)"]
      Eng[engagement]
      Srch[search]
      Rt[messaging · notifications]
      Collab[collaboration]
      Ver[verification]
      Mod[moderation]
      Use[usage cost guard]
      Ann[annotations]
      Music[Jamendo music]
      AI["AI · dictation (planned)"]
    end
    Worker["Video worker<br/>VIDEO_JOB_T, SKIP LOCKED"]
    Repo["Repositories: parameterised SQL only"]
    Store["Storage driver: R2 (metered) | local (dev only)"]
  end

  DB[("PostgreSQL 17<br/>dbmate migrations")]
  R2[("Cloudflare R2<br/>WebP, MP4, posters")]
  Ext["External APIs<br/>Unsplash · Jamendo<br/>Groq · Gemini · Workers AI (planned)"]

  Client -- "HTTPS /api (httpOnly JWT cookie + X-Requested-With)" --> MW
  Client -- "Socket.io (events + typing only)" --> Rt
  MW --> Features
  Features --> Repo --> DB
  Notes --> Store --> R2
  Worker --> DB
  Worker --> Store
  Music --> Ext
  AI -.-> Ext
```

## 2. Deployment (D74: one free origin)

```mermaid
flowchart LR
  Users["Students, lecturers, guests<br/>(campus NAT: many users, one IP)"]

  subgraph CF["Cloudflare (Workers Free plan, fail closed)"]
    Pages["Pages: *.pages.dev<br/>static SPA on CDN"]
    Fn["Pages Function proxy<br/>/api/* and /socket.io/*<br/>XFF := CF-Connecting-IP<br/>100k requests/day cap"]
  end

  subgraph Render["Render free web service (512 MB, 0.1 CPU, sleeps after 15 min)"]
    Api["Express API + Socket.io<br/>TRUST_PROXY=2, startup guards"]
    VW["In-process video worker<br/>VIDEO_PROFILE=free (≤720p, 1 job)"]
  end

  Neon[("Neon Postgres free<br/>0.5 GB, autosuspend")]
  R2[("Cloudflare R2 free<br/>app caps at 80% / 50%")]
  Ext["Unsplash · Jamendo · Sentry<br/>Groq · Gemini · Workers AI (planned)"]

  subgraph GH["GitHub Actions"]
    CI["ci.yml: vp check, tests (Postgres 17), build"]
    Purge["purge.yml: daily db:purge"]
    Deploy["deploy: dbmate migrate → deploy hooks (planned, R11)"]
    K6["k6 load test + keep-awake ping (planned, R27)"]
  end

  Users --> Pages
  Users --> Fn
  Fn --> Api
  Api --> Neon
  Api --> R2
  Api --> Ext
  VW --> Neon
  VW --> R2
  Purge --> Neon
  Deploy -.-> Neon
  Deploy -.-> Render
  Deploy -.-> Pages
  K6 -.-> Fn
```

## 3. Async video upload (D67)

```mermaid
sequenceDiagram
  autonumber
  actor U as Uploader
  participant A as API
  participant DB as Postgres
  participant S as R2
  participant W as Video worker

  U->>A: POST /api/assets/videos
  A->>A: ffprobe (size, length, container)
  A->>S: put original (o/ key)
  A->>DB: insert asset (processing) + VIDEO_JOB_T row
  A-->>U: 202 { status: processing }
  A->>W: wake
  W->>DB: claim oldest job (FOR UPDATE SKIP LOCKED, 2 min lease)
  W->>S: get original
  W->>W: ffmpeg (stream-copy or ≤720p re-encode)
  W->>S: put MP4 + WebP poster
  W->>DB: asset ready, job done
  W->>S: delete original
  loop every 4 s
    U->>A: GET /api/assets/:id
    A-->>U: processing | ready | failed
  end
```
