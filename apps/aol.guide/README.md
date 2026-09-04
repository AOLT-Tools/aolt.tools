# AOL Guide

AOL Guide is a lightweight NLP wrapper over official Art of Living, VVMVP Bangalore Ashram, and Vaidic Puja search pages.

It does **not** keep a local course/program database. A query is parsed into a normalized intent, then translated into the official source's own filter URL where one exists.

## Local commands

From the repository root:

```sh
pnpm install
pnpm dev:aol.guide
pnpm build:aol.guide
pnpm --dir apps/aol.guide test
pnpm --dir apps/aol.guide typecheck
pnpm aol-guide:search "HP near 560045 within 10km"
pnpm aol-guide:pincodes
```

`pnpm dev:aol.guide` serves the UI on http://127.0.0.1:5174 and handles `POST /api/search` (also `POST /api/aol-guide/search`) in Vite.

## How search works

1. One natural-language query
2. Deterministic parser (Gemini only if the query is incomplete/ambiguous)
3. PIN → lat/lng via Mapbox Temporary Geocoding when a token is set, otherwise `data/pincodes.json`
4. Source router (AOL, VVMVP, and/or VDS)
5. Official URL + live AOL listings (from `new-search-course`) in the UI

Example:

```text
HP near 560045 within 60km
```

becomes an Art of Living course-search hash URL with HP course types, PIN `560045`, resolved coordinates, and `distance=60`, then loads matching programs from the official JSON API.

Teacher queries search Follow Up first with the same location/date filters, then other program types only if Follow Up returns nothing.

## Official sources

- Art of Living: https://www.artofliving.org/in-en/search/course
- VVMVP Bangalore Ashram: https://programs.vvmvp.org/ashrams/bangalore/
- Vaidic Puja: https://register.vaidicpujas.in/

See `docs/official-sources.md` for what each site actually supports.

## Environment

Copy `.env.sample` to `.env.local` in this app directory.

Optional Mapbox Temporary Geocoding for PIN → lat/lng. If unset, search uses `data/pincodes.json`:

```sh
AOL_GUIDE_MAPBOX_TOKEN=
```

Optional Gemini fallback:

```sh
AOL_GUIDE_GEMINI_API_KEY=
AOL_GUIDE_GEMINI_MODEL=gemini-2.5-flash-lite
```

Gemini never receives official program listings. It only converts difficult natural language into `SearchIntent`. Mapbox coordinates are used only for the current search and are not saved.

## Vercel

Root Directory: `apps/aol.guide`. The only serverless entrypoint is `api/search.ts`.
