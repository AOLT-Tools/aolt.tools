# AOLT Tools

AOLT Tools is a pnpm workspace containing two independently deployable applications:

- `apps/aol.guide` — AOL Guide (NLP wrapper over official search pages)
- `apps/seva.hub` — Seva Hub

Shared platform code lives under `packages/`:

- `packages/shared` — common contracts
- `packages/core` — API primitives, errors, environment, normalization, IST dates, local env loading
- `packages/integrations` — Google OAuth/Sheets, Blob, WhatsApp, Mapbox geocoding, Gemini JSON

The repository root is **not a Vercel application**. It contains workspace tooling, shared tests and documentation only. There is intentionally no root `api/` or root `vercel.json`.

## Local development

```bash
pnpm install
pnpm run dev:aol.guide
pnpm run dev:seva.hub
```

Run checks from the repository root:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm format
```

## Vercel deployment

Create two Vercel projects from the same GitHub repository.

| Vercel project | Root Directory   | Build Command | Output Directory |
| -------------- | ---------------- | ------------- | ---------------- |
| AOL Guide      | `apps/aol.guide` | `pnpm build`  | `dist`           |
| Seva Hub       | `apps/seva.hub`  | `pnpm build`  | `dist`           |

`AOLT_APP`, `AOLT_OUTPUT_DIR`, `build:selected`, and `dist/selected-app` are no longer used. The app root itself selects what gets built and which `/api` handlers Vercel discovers.

AOL Guide has no course database. It wraps official Art of Living, VVMVP, and Vaidic Puja search pages. See `apps/aol.guide/README.md`.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel setup.
