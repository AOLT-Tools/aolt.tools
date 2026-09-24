# Official source research

Inspected 2026-09-04 from the public pages and their frontend bundles. No undocumented parameters were invented.

## Art of Living course search

Page: https://www.artofliving.org/in-en/search/course

Filter mechanism: hash fragment parsed with `URLSearchParams(window.location.hash.slice(1))`.

JS bundle: `/in-en/app/plugins/wp_artofliving/assets/course_search_with_filter_pills/bundle.js`

Verified hash keys used by the official UI:

- `ctype` (comma-separated course type IDs)
- `is_online_event` (`1` = online)
- `mode` (`In Person`, `Online`, `Hybrid`)
- `course_language` or `language` (ISO codes such as `hi`, `en`; omit when not specified)
- `lat`, `lng`, `distance`
- `type` (`search` when coordinates exist, otherwise `country`)
- `country`
- `selectedLocName` or `place_name`
- `start_date_from`, `start_date_to`
- `start_time_from`, `start_time_to`
- `current_day_time_from` (today-only helper, `hours.minutes`)
- `has_voucher`, `include_private`

Empty values are omitted from the hash. In particular `is_online_event` is only set for an explicit online / in-person filter; omitting it keeps all modes, matching the official page.

`course_language` uses the official ISO codes (`hi`, not `Hindi`).

`ctype` is split on commas and matched against official course-type values. AOL Guide keeps the course-type ids from the official program filters in `courseAliases.ts`. Programs without their own chip are categorized as Other.

Live listings: AOL Guide loads JSON from `https://www.artofliving.org/india-search-course-api` with the same filters plus `limit` and `offset` (offset is a 1-based page number). The API returns one page of 20 rows. An in-person catalog search therefore requests one page per program, using that program's official course-type ids, and merges them. Follow Up stays on the Center catalogue. Listings are not stored. `dist` in the payload is meters.

The official location box accepts a place or PIN through Mapbox, then searches with `lat` / `lng`. There is no pincode query parameter on the listings API. AOL Guide uses Mapbox Temporary Geocoding (`permanent=false`) in the browser for place suggestions and sends those coordinates on the catalog request. Coordinates are used only for the current request and are not written to disk.

No `X-Frame-Options` or CSP `frame-ancestors` was present on the HTML response. The UI shows live listing cards plus a Register or More Info link to the official page.

## VVMVP Bangalore Ashram

Page: https://programs.vvmvp.org/ashrams/bangalore/

Filter mechanism: browser-side list widget (`list-event.js`) plus an inline `vvmvp_event_list` payload.

Verified shareable URL parameter:

```js
const initialSearch = (urlParams.get('search') || urlParams.get('s') || '').trim();
```

Adapter implementation: `https://programs.vvmvp.org/ashrams/bangalore/?search=AMP`

Dates, PIN, distance, language, and delivery mode are not URL parameters.

Live listings: the Bangalore ashram page embeds `var vvmvp_event_list = { nonce, url, programs, languages, ashrams, events }`. AOL Guide can fetch that page server-side and keep events whose `ashram_id` matches the Bangalore ashram (`slug: bangalore`). Register links follow `list-event.js`: `/events/{id}`, or `/donate/{id}` when `category_id` is `4`. The authenticated `bot/get-upcoming-events` REST route is not used.

No undocumented query parameters are added. `?search=` remains the only verified shareable URL parameter.

## Vaidic Puja

Page: https://register.vaidicpujas.in/

Next.js app-router page. Search is React state. `?search=` and `?q=` do not change the server HTML. There is no confirmed shareable filter URL.

Adapter implementation: open `https://register.vaidicpujas.in/`.

The older `vaidicpujas.org` DataTables endpoint is a different site and is not used here.
