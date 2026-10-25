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
- **Ask the user before**: scope changes, paid services, new keys, deleting user files, repository settings.
- **Report drafts** stay in Markdown in `../FYP_Submissions/drafts/` until the final .docx pass.
- **Diagrams** are Mermaid text, never PlantUML.
