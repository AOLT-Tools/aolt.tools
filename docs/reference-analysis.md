# Reference analysis

The completed application at
C:\Users\saurajai\DevEnv\PoC\seva.hub was treated as read-only.
This starter extracts its integration patterns without copying its Seva Hub domain
or interface.

## Retained

- Vite multi-page HTML with Alpine registered from a browser entry module.
- Shared Zod contracts at browser/server boundaries.
- A runtime facade and repository interfaces with mock and API modes.
- Server-only Google OAuth, anti-forgery state, verified ID tokens, and signed
  HTTP-only cookies.
- Header-driven Google Sheets access, batch writes, stable IDs, service-account
  authentication, and diagnostic scripts.
- Exact raw-body verification for Meta webhooks, bounded upstream calls, and
  structured event parsing.
- Typed error envelopes, trace IDs, safe logs, explicit timeouts, and a test
  protecting the Vercel function budget.

## Generalized

- Campaigns, leads, members, courses, and short links became declarative
  ResourceDefinition entries.
- Authorization became a per-resource policy rather than volunteer-specific logic.
- Image storage became a generic file attachment flow.
- WhatsApp lead parsing became a replaceable plugin.
- Sheet names, headers, aliases, create validation, writable fields, ownership,
  and seeds now live in the application manifest.

## Improved

- OAuth adds a nonce and requires a verified email.
- Sessions accept current and previous signing secrets for rotation.
- Mutations require both an allowed origin and a session-bound CSRF token.
- Production webhook idempotency uses create-only private Blob markers instead
  of process-local maps and timers.
- Blob access uses the official SDK and supports Vercel OIDC.
- Uploads validate magic bytes and compensate when the metadata write fails.
- Replacement commits new metadata before cleaning up the old object.
- Sheet mutations use optimistic versions and re-read stable IDs immediately
  before changing a row.
- Diagnostics are dry-run by default and have explicit fix variants.

## Deliberately excluded

- Seva Hub branding, campaign rules, course types, Indian phone normalization,
  volunteer assignment, and the existing UI.
- Assumptions that a warm Vercel function will retain business state.
- Automatic retry of non-idempotent Sheet appends.
- A promise of full transactions across Sheets and Blob. The starter uses
  ordering, version checks, compensation, and doctor scripts because those
  services do not share a transaction coordinator.
