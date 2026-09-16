# M0 / M1: shop and Brand Kit

## Scope

M1 adds `/dashboard/brand` and a dashboard entry. Signed-in users can save a shop name, optional private logo, two colors, contact channels, payment methods, CTA, tone, and explicitly confirmed owner statements. Blank optional fields remain blank. Brand Kit is available to authenticated accounts without changing subscription snapshots or image quota. It does not yet change image prompts; video and other consumers are subsequent modules.

M0 checked the working-tree implementation, not only committed files. Existing scripts include `npm test` (41 baseline tests) despite older agent notes saying otherwise. Existing auth, subscriptions, payment review, generator, history and game-content flows remain the source of truth. Only an additive dashboard card changes an existing page. No production recovery files were edited.

## Data and deployment

- Additive migration: `db/migrations/20260914_brand_kit.sql`.
- One shop per owner, created on first save, not on GET or sign-up.
- Each successful save inserts a new immutable-by-application profile revision. The shop's pointer changes in the same transaction; a deferred FK prevents a dangling pointer.
- The API accepts the expected version. A locked shop row serializes writes and stale versions return 409. Future jobs must pin `(shop_id, version)` rather than resolve the latest profile at render time.
- Logo ownership is checked for both attachment and viewing. Logos use existing private Vercel Blob credentials; source URLs never reach the client. Logos are decoded, limited to 16 million pixels, rotated, stripped of metadata and converted to WebP up to 512px.
- Logo rows are registered before storage writes and marked ready afterwards. Failed or ambiguous uploads remain tracked and cannot be attached until ready. At most 20 upload attempts/hour/account. Previous logos remain available to old revisions. M2 must implement retention/cleanup by reference; never delete a logo merely because the latest profile replaced it.
- Limits: 2 MB raw logo, 16 KB profile request, five owner statements. Owner confirmation is not independent verification of a claim.
- Mutation endpoints require matching Origin. Authentication and owner filters run on every request. No admin override. Responses use private/no-store. Missing DB/storage fails closed with user-facing recovery messages.

Do not automatically run all pending migrations on an existing environment. After identifying the target development database and checking backup/migration state, apply only:

`npm.cmd run db:migrate -- --only=20260914_brand_kit.sql`

For a fresh installation, apply the existing schema and then this migration. `db/schema.sql` is not rewritten in M1. Existing `.env.local` is not overwritten. No live migration or deployment was performed as part of this implementation.

## Repeatable isolated verification

Install tools outside runtime dependencies (ignored directory):

`npm.cmd install --prefix .test-build/brand-tools --no-package-lock @electric-sql/pglite @electric-sql/pglite-socket agent-browser`

Start `node scripts/brand-test-server.mjs`. This builds an in-memory PostgreSQL-compatible DB from the existing schema plus M1 migration and starts the app at `http://localhost:3107`. It overrides DATABASE_URL with localhost, blanks Blob/AI keys and uses a separate test-session cookie. The server must stay running during the following commands:

- `npm.cmd run test:brand` — validation, truthful defaults, unsafe URLs, bounds, image decoding/resizing.
- `npm.cmd run test:brand:api` — unauthenticated requests, cross-origin requests, save/reload, account isolation, preserved old revisions, stale writes, foreign logos, oversized/malformed payloads and unavailable storage.
- `npm.cmd test`, `npm.cmd run test:prompt`, `npm.cmd run lint`, `npm.cmd exec -- tsc --noEmit`, `npm.cmd run build` — regression/static/build checks.

Browser acceptance: sign up with a disposable `example.test` account; visit Brand Kit; save name and LINE; reload; change name and save another version; inspect the mobile layout; check dashboard entry and generator home; check page errors.

## Verification boundaries before rollout

PGlite has one underlying backend. It verifies SQL/schema and sequential stale-write rejection, but is not evidence of PostgreSQL multi-session lock contention. Repeat competing saves on an isolated real PostgreSQL database before rollout. The production code uses a transaction and FOR UPDATE for this purpose.

The isolated server intentionally disables Blob credentials. Local tests cover image normalization, ownership and the unavailable-storage path; actual private Blob upload/download must be checked with a designated development Blob store before rollout. No claim of live storage verification or live migration is implied.

M0 follow-ups outside M1: the legacy generator's auth behavior when DB is missing and its non-reserved quota need their own scoped fixes before extending that flow. They were not silently rewritten in this module.
