# Validation performed in this handoff

The restructuring was validated with checks that do not require downloading npm packages:

- All JSON files parse successfully.
- `pnpm-lock.yaml` parses successfully and contains importers matching each new workspace `package.json`.
- Every relative TypeScript/JavaScript import resolves to a source file after the moves.
- Every `@aolt/core/*`, `@aolt/integrations/*`, and `@aolt/shared/*` import maps to an exported workspace source file.
- TypeScript/TSX syntax was parsed with the locally available TypeScript compiler API; no syntax diagnostics were found.
- AOL Guide's function allow-list check passes with exactly four API entrypoints.
- Seva Hub's function allow-list check passes with exactly six API entrypoints.
- There is no root `/api`, no root `vercel.json`, and no `apps/seva.hub/api/_lib`.

A full `pnpm install`, `pnpm typecheck`, `pnpm test`, and Vite build could not be executed in the artifact container because outbound package-registry access is disabled and the uploaded source ZIP does not include `node_modules`.

Run these after replacing the repository:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build:aol.guide
pnpm build:seva.hub
```
