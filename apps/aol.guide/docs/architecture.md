# AOL Guide architecture

## Before

The previous AOL Guide (in the aolt.tools monorepo) synced official listings into Postgres:

```text
AOL / VVMVP / VDS sources
        |
        v
sync jobs + Neon/Postgres
        |
        v
SQL search over local copies
        |
        v
CLI / API / browser
```

That path depended on `aol_guide_courses`, `aol_guide_activities`, `aol_guide_vds_events`, background sync, and listing SQL.

## After

This app is an NLP wrapper over official search pages. There is no course/program database.

```text
user query
    |
    v
deterministic parser
    |
    +-- if complete --> SearchIntent
    |
    +-- else optional Gemini --> SearchIntent
    |
    v
PIN coordinate resolver (Mapbox Temporary Geocoding, else data/pincodes.json)
    |
    v
source router
    |
    +--> AOL adapter  --> official hash URL + live listings JSON
    +--> VVMVP adapter --> /ashrams/bangalore/?search=
    +--> VDS adapter   --> canonical register.vaidicpujas.in
    |
    v
browser: interpreted filters + live AOL listings + source cards
```

AOL listings are fetched live from the public `new-search-course` JSON API at request time. They are not stored.

## SearchIntent

```ts
type SearchIntent = {
  source?: 'aol' | 'vvmvp' | 'vds' | 'all';
  courseCode?: string;
  courseLabel?: string;
  pincode?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  language?: string;
  deliveryMode?: 'online' | 'in_person' | 'any';
  dateFrom?: string;
  dateTo?: string;
  startTimeFrom?: string;
  startTimeTo?: string;
  teacher?: string;
  keywords?: string[];
};
```

Intent stays source-independent. Adapters own URL construction.

## Modules

```text
lib/searchIntent.ts
lib/queryParser.ts
lib/pincodeCoordinates.ts   # bundled PIN JSON + Mapbox-then-local fallback
lib/sourceRouter.ts
lib/sources/aolSearchAdapter.ts
lib/sources/aolListings.ts
lib/sources/vvmvpSearchAdapter.ts
lib/sources/vdsSearchAdapter.ts
src/searchSuggestions.ts
```

Shared platform helpers used by this app:

- `@aolt/core/normalization` — Indian PIN
- `@aolt/core/dates` — IST calendar and weekend presets
- `@aolt/core/local-env` — `.env` / `.env.local` for CLI
- `@aolt/integrations/mapbox/geocode` — Mapbox Temporary Geocoding (not stored)
- `@aolt/integrations/gemini/json` — Gemini JSON generateContent client

## What this app does not do

- Neon/Postgres or listing SQL
- Sync jobs or local copies of program rows
- Scraping official pages into a backend
- Invented VVMVP/VDS query parameters
- Proxying third-party pages to bypass iframe/CORS
- Seva Hub changes
- Advanced search forms
