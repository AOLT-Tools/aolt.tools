# AOL Guide architecture

## Before

The previous AOL Guide synced official listings into Postgres and searched local copies. That path is gone.

## After

This app is a live catalog over official search APIs. There is no course/program database and no NLP query box in the product UI.

```text
Courses | Center  +  In-person | Online  +  Mapbox place
        |
        v
POST /api/search  { source, mode, dates, radiusKm, location }
        |
        v
AOL adapter --> official hash URL + india-search-course-api listings
VVMVP / VDS adapters remain for catalog source ids (not in the top toggle)
        |
        v
browser: listing cards (Register / More Info)
```

Place suggestions use Mapbox Temporary Geocoding (`permanent=false`). Search Box Sessions are not used.

## Catalog request

```ts
type OfficialSearchRequest = {
  source: 'aol' | 'center' | 'vvmvp' | 'vds';
  mode?: 'in_person' | 'online';
  location?: { label: string; latitude: number; longitude: number; city?: string };
  datePreset?: 'anytime' | 'today' | 'tomorrow' | 'this_weekend' | 'next_7_days' | 'custom';
  dateFrom?: string;
  dateTo?: string;
  radiusKm?: number;
};
```

Courses (`aol`) drop Follow-up and Satsang. Center keeps those in-person listings.

## Modules

```text
lib/searchIntent.ts
lib/searchService.ts
lib/searchRequest.ts
lib/sourceRouter.ts
lib/courseCategories.ts
lib/sources/aolSearchAdapter.ts
lib/sources/aolListings.ts
lib/sources/vvmvpSearchAdapter.ts
lib/sources/vdsSearchAdapter.ts
src/search.ts
src/mapboxSearchJs.ts
```

Shared platform helpers used by this app:

- `@aolt/core/geo` — lat/lng validation
- `@aolt/core/dates` — IST calendar and weekend presets
- `@aolt/core/local-env` — `.env` / `.env.local`
- `@aolt/integrations/mapbox/geocode` — Temporary Geocoding (not stored)
- `@aolt/integrations/gemini/json` — Gemini JSON client (framework only; this app does not call it)

## What this app does not do

- Neon/Postgres or listing SQL
- Bundled PIN datasets
- Natural-language query parsing in the AOL Guide app
- Search Box Sessions or `@mapbox/search-js-web`
- Scraping official pages into a backend
- Invented VVMVP/VDS query parameters
- Proxying third-party pages to bypass iframe/CORS
- Seva Hub changes
