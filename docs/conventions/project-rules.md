# Project rules

These come from the Investigation Report (IR) the project is marked against.

- **Scope** is the IR's functional requirements (`../FYP_Resources/IR/Mine/*_IR.md` §3.3.3). Cutting or shrinking one
  needs a technical reason and the user's agreement. Additions must serve the four objectives and get an ADR.
- **Stack is fixed** (changing it means rewriting the report): React + Vite + TypeScript + Tailwind, Node + Express,
  PostgreSQL, Socket.io, JWT in an httpOnly cookie + Passport, versioned migrations. Toolchain Vite+ with pnpm.
- **AI**: the feed ranking stays a heuristic with no ML. AI appears only as the approved optional aids (editor
  assistant, photo import, dictation) and never beyond a provider's free tier.
- **Local first**: the local stack is what the demo and submission use. Live deployment is optional (D82); a deploy
  change must never alter local behaviour or add a required local env value.
  - Live deploy is the owner's personal goal and stays unmarked. If it is ever attempted, it uses free hosting only (D74).
    Fly.io is not free (owner), so it is ruled out. Render's free tier is the preferred candidate to research.
  - Free-tier limits (spin-down, database retention), Socket.io and Postgres fit, and the Pages proxy, `CLIENT_ORIGIN` and
    cookie settings are for a dedicated session. That session uses the researcher agent and checks each limit against
    official docs before relying on it.
- **Ask the user before**: scope changes, paid services, new keys, deleting user files, repository settings.
- **Report drafts** stay in Markdown in `../FYP_Submissions/drafts/` until the final .docx pass.
- **Diagrams** are Mermaid text, never PlantUML.
