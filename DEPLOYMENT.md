# Deployment

This repository is a pnpm workspace. Each app is an independent Vercel project.

## AOL Guide

Create a Vercel project from the same GitHub repository and set:

- Root Directory: `apps/aol.guide`
- Build Command: `pnpm build`
- Output Directory: `dist`
- Install Command: default pnpm install

Do not set `AOLT_APP`. It no longer exists.

Only this source file is allowed under `apps/aol.guide/api` and therefore becomes a Vercel Function:

- `api/search.ts`

`pnpm build` runs `scripts/verify-functions.mjs` first and fails if another deployable JS/TS file is accidentally placed under `api/`.

AOL Guide does not use Postgres, sync jobs, or cron. It loads live listings from `india-search-course-api` using catalog filters (source, mode, Mapbox coordinates, radius, dates).

### Important AOL Guide environment variables

- `AOL_GUIDE_MAPBOX_TOKEN` for browser place suggestions via Mapbox Temporary Geocoding (`permanent=false`). Do not use Search Box Sessions.

## Seva Hub

Create a second Vercel project from the same repository and set:

- Root Directory: `apps/seva.hub`
- Build Command: `pnpm build`
- Output Directory: `dist`

Only the following handlers remain under its `api/` directory:

- `api/auth.ts`
- `api/bootstrap.ts`
- `api/courses.ts`
- `api/leads.ts`
- `api/health/sheets.ts`
- `api/whatsapp/webhook.ts`

All former `api/_lib/*` helpers were moved to `apps/seva.hub/server/`, so they are imported by functions but are not themselves function entrypoints.

## Shared packages

Shared framework code lives under:

- `packages/shared`
- `packages/core`
- `packages/integrations`

The apps that need shared code depend on these using `workspace:*`. AOL Guide
uses core (PIN, IST dates, local env) and integrations (Mapbox Temporary
Geocoding, Gemini JSON). Search intent, official adapters, and the bundled PIN
dataset stay in the app.
