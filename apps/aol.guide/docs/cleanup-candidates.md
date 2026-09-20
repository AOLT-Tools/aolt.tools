# Old AOL Guide cleanup

The database-backed AOL Guide that used to live in this app directory has been
removed. Bundled PIN JSON, NLP query parsing, Gemini intent parsing, and the
Mapbox Search Box debug page were also removed from this app.

Shared Mapbox Temporary Geocoding and Gemini JSON helpers remain in
`packages/integrations`. This app uses only Temporary Geocoding for place
suggestions.

Seva Hub was not changed as part of that replacement.

Activity management, Google OAuth, Neon/Postgres, and sync jobs are intentionally
not part of this app.
