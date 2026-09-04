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

`course_language` uses the official ISO codes (`hi`, not `Hindi`). AOL Guide still shows the language name in interpreted filters.

`ctype` is split on commas and matched against official course-type values. AOL Guide reuses existing course alias type IDs (for example HP `313040`, ...) and does not guess new IDs.

Live listings: the official page loads JSON from `https://www.artofliving.org/new-search-course` with the same filters plus `limit` and `offset` (offset is a 1-based page number). AOL Guide fetches the first page of that API at search time and does not store courses. `dist` in the payload is meters.

The official location box accepts a PIN through Mapbox autocomplete, then searches with `lat` / `lng`. There is no pincode query parameter on `new-search-course`. AOL Guide geocodes Indian PINs with Mapbox Temporary Geocoding (`permanent=false`) when `AOL_GUIDE_MAPBOX_TOKEN` is set. Those results are used for the current request only and are not written to disk. If the token is missing, it falls back to `data/pincodes.json`.

No `X-Frame-Options` or CSP `frame-ancestors` was present on the HTML response. The UI shows live listing cards plus "View official results"; preview iframe is opt-in when listings are not shown.

## VVMVP Bangalore Ashram

Page: https://programs.vvmvp.org/ashrams/bangalore/

Filter mechanism: browser-side list widget (`list-event.js`) plus an inline `vvmvp_event_list` payload.

Verified shareable URL parameter:

```js
const initialSearch = (urlParams.get('search') || urlParams.get('s') || '').trim();
```

Adapter implementation: `https://programs.vvmvp.org/ashrams/bangalore/?search=AMP`

Dates, PIN, distance, language, and delivery mode are not URL parameters. Those are shown in AOL Guide as interpreted context / unsupported official filters.

No public fetch API is used. The old HTML scrape path is intentionally not reused.

## Vaidic Puja

Page: https://register.vaidicpujas.in/

Next.js app-router page. Search is React state:

```js
const [g, f] = useState("");
// client filter over allProcessedEvents by Seva / Activity / Venue / category / tags
```

`?search=` and `?q=` do not change the server HTML and are not read by the page module. There is no confirmed shareable filter URL.

Adapter implementation: open `https://register.vaidicpujas.in/` and show the interpreted puja/date/keyword context in AOL Guide.

The older `vaidicpujas.org` DataTables endpoint is a different site and is not used here.
