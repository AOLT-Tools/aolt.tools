# AOL Guide

AOL Guide is a live catalog of official Art of Living courses and center programs. It does **not** keep a local course database.

The UI searches with a source (Courses or Center), in-person or online, a Mapbox place, and a radius. The server forwards those filters to the official India course API and returns listing cards.

## Local commands

From the repository root:

```sh
pnpm install
pnpm dev:aol.guide
pnpm build:aol.guide
pnpm --dir apps/aol.guide test
pnpm --dir apps/aol.guide typecheck
```

`pnpm dev:aol.guide` serves the UI on http://127.0.0.1:5174 and handles `POST /api/search` (also `POST /api/aol-guide/search`) in Vite.

## How search works

1. Choose Courses or Center, then In-person or Online
2. Pick a place with Mapbox Temporary Geocoding (`permanent=false`, not Search Box Sessions)
3. Server calls `https://www.artofliving.org/india-search-course-api` with lat/lng, radius, and dates
4. Courses hide Follow-up and Satsang; Center keeps those in-person listings

The browser never sends a natural-language query. Location coordinates are used only for the current search and are not saved.

## Official sources

- Art of Living listings: https://www.artofliving.org/india-search-course-api
- Art of Living course page: https://www.artofliving.org/in-en/search/course
- VVMVP Bangalore Ashram (API still available): https://programs.vvmvp.org/ashrams/bangalore/
- Vaidic Puja (API still available): https://register.vaidicpujas.in/

See `docs/official-sources.md` for what each site actually supports.

## Environment

Set a Mapbox public token for place suggestions. Temporary Geocoding stays in the Mapbox free tier; do not use Search Box Sessions.

```sh
AOL_GUIDE_MAPBOX_TOKEN=
```

Gemini JSON helpers remain in `@aolt/integrations/gemini`. This app does not call Gemini.

## Vercel

Root Directory: `apps/aol.guide`. The only serverless entrypoint is `api/search.ts`.
