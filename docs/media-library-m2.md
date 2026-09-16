# M2 — Private media library and background jobs

## Delivered scope

`/dashboard/library` has files, project collections and job status tabs. Users upload images/clips, download validated originals, group 1–10 files into a project, save new immutable project revisions with the current brand version, and delete unreferenced files/projects. No video is rendered yet. Existing generator, image history, subscription snapshots and image usage accounting stay unchanged.

Brand setup stays optional: the first library write creates an empty brand revision if the account has no shop yet. M1 then edits that revision normally. Current pilot policy is stored in `media_policy`: 500 MiB storage, 10 MiB images, 100 MiB videos, 30-day retention. Additional operational caps are 100 active files, 100 projects and 30 new upload requests/hour. These are infrastructure caps, not new paid package promises. No video-render entitlement is granted.

## Data and concurrency

Apply `20260914_brand_kit.sql` first, then `20260914_media_library.sql` to the intended development database. Do not run every unreviewed pending migration. No live database migration or deployment was performed for this module.

An upload request stores the asset, reserves storage in a locked usage bucket and records the ledger event in one transaction. A UUID request key with a canonical payload hash makes duplicate submissions return the same asset; different content with that key returns 409. Shop locks serialize reservations and project edits; composite foreign keys prevent cross-shop asset references.

The upload completion transaction sets the asset queued and inserts its unique job. PostgreSQL is the durable queue, so there is no separate queue-send/database-write gap. Workers claim with FOR UPDATE SKIP LOCKED, a unique lease and a two-minute expiry. Heartbeats extend only live leases. Results commit only while the same live lease still owns the job. Attempts are logged and expired leases are reclaimable. These are at-least-once jobs; effects and quota settlement are idempotent, not a promise of exactly-once execution.

Successful validation moves reserved bytes to used bytes exactly once. Invalid files or exhausted verification retries switch the job to deletion. Deletion failures keep the reservation/charge and retry with capped backoff: space is not falsely refunded while storage still contains the object. Successful physical deletion releases it once. Original reservation/bucket links are retained. `video_render` is a reserved meter name for M3; M2 only implements storage-byte reservation/settlement.

## File transport and validation

- Production transport: existing `@vercel/blob/client`, direct to a **private** store. No 100 MB files pass through a Vercel upload function.
- Upload tokens require an authenticated same-origin request and exact owned server-generated pathname. Type, byte limit and a fixed 15-minute deadline are bound to the token. Reissuing a token while the same upload is pending is safe: the pathname is fixed and overwriting is disabled.
- The SDK verifies completion callback signatures. A user-authenticated completion endpoint also queues verification when the client finishes. Neither completion path marks content ready.
- Worker fetches by recorded private pathname, bounds the stream to the declared length, and validates content itself. Images are fully decoded with Sharp and bounded to 40 million pixels; animated/SVG/corrupt input is rejected. Bytes are not rewritten, preserving poster prices.
- Videos are inspected by ffprobe on a generated temporary path, with an argument array, timeout, bounded output, file-only protocol and MOV/MP4/WebM demuxer allowlist. Limit: 120 seconds and 16,777,216 pixels/frame. Metadata inspection is not a guarantee that every video frame decodes; rendering validation belongs in M3.
- Private download endpoints check ownership, ready state and expiry on every request and stream attachments with no-store/nosniff headers. There is no public download URL or raw storage token in library responses. M2 offers downloads, not an in-browser video streaming player.

## Lifecycle and cancellation

Deleting an in-flight asset fences its verifier. Cleanup waits for any worker lease and, where an upload token was issued, until the token deadline plus a conservative 24-hour grace. This protects against delayed uploads recreating a deleted object. UI says space is returned after deletion, not immediately. Cleanup retries remain visible. Abandoned uploads are collected after the same grace window.

All project revisions pin their source files and brand version. Saving a new revision extends retention of every referenced input to the project's new expiry. A referenced asset cannot be deleted alone; deleting a project explicitly removes its revisions/reference links while leaving source files in the library. Expired projects/unused assets are swept by the worker. Keep future render-job foreign keys restrictive when adding M3.

M1 orphan logo cleanup only removes logos older than two days that are absent from **all** historical brand profiles. The cleaner takes a logo row lock, checks references, marks it unavailable, then deletes from Blob. M1 attachment now holds FOR SHARE on the logo until its revision commits, preventing a concurrent cleanup/attachment race. Referenced old logos are preserved. Live Blob cleanup still needs staging validation.

## Worker setup

Use an external persistent Node 24 worker host with ffprobe on PATH (or set `FFPROBE_PATH`), plus the same intended DATABASE_URL and private BLOB_READ_WRITE_TOKEN. Build and launch:

1. `npm.cmd run media:worker:build`
2. `npm.cmd run media:worker`

Deploy the compiled `.test-build/media-worker` artifact with the runner and runtime dependencies on that host. This local output directory is ignored by Git. Run with a process supervisor; no worker service is provisioned automatically. Shutdown completes the current bounded operation. Unexpected infrastructure errors exit nonzero for the supervisor to restart. Multiple instances are supported by database claims. The worker sweeps periodically; there is no new Vercel cron.

## Repeatable verification on Windows

Tools are installed under ignored `.test-build/brand-tools`, not application dependencies:

`npm.cmd install --prefix .test-build/brand-tools --no-package-lock @embedded-postgres/windows-x64 ffprobe-static ffmpeg-static agent-browser`

- Start `node scripts/media-test-server.mjs`. It creates a fresh real PostgreSQL cluster under `.test-build`, binds only to 127.0.0.1:55439, applies the existing schema + M1/M2, and starts Next at localhost:3107.
- The process explicitly sets a loopback database, an isolated session cookie, empty Blob/AI keys and filesystem test storage. It does not load real environment values into the test DB runner or migrate real data. Next still reads other existing configuration; tests do not invoke generation/payment operations.
- `npm.cmd run test:media` compiles the real worker and runs file validation + API/DB/storage/worker integration. Do not run the demonstration worker at the same time as deterministic claim tests.
- For browser review, start `node scripts/media-test-worker.mjs` after tests. It runs the same queue processor with fixed local test configuration and ffprobe. Upload the PNG/MP4 fixtures under `.test-build`, save a project, reload, save a new version and inspect statuses.
- `npm.cmd run test:brand:api` can also run against this real PostgreSQL fixture.

Filesystem test transport is disabled when NODE_ENV=production or the DB hostname is not loopback. It restricts file keys to generated media UUID paths under `.test-build/media-store`. It is an explicit local storage adapter, not evidence that Vercel Blob was contacted.

Verified cases include duplicate requests, competing last-slot reservations, owner isolation, original-byte download, one claim per job, expired-lease recovery, single quota charge/refund, invalid-image cleanup, abandoned upload cleanup, project revision preservation, protected references, MP4 metadata, overlong-video rejection, playlist rejection and unchanged image usage. Actual signed Blob uploads/callbacks/downloads and the chosen external worker host still require staging checks before production rollout.
