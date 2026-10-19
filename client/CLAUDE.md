# client (React 19 + Vite+, Tailwind v4, shadcn/ui)

- Read `DESIGN.md` before any UI change: tokens only, no raw colours or palette classes; reuse `src/components/ui/`
  and `src/components/` before adding a component.
- Pages and components live in `src/features/<feature>/`; shared hooks and helpers in `src/lib/` and `src/hooks/`.
  Data: `useFetch` / `usePaged` for reads, `useAction` for writes, all through `src/lib/api.ts` (it adds the
  `X-Requested-With: notalah` header and handles session expiry).
- Every screen works at 1440 px and 375 px, light and dark, with keyboard focus and labels.
- Tests: `*.test.ts(x)` beside the code, named with their `CLI-TC` ID; render tests start with
  `// @vitest-environment jsdom`. Run `vp run client#test`.
