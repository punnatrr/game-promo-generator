# M3 — Promotion image to motion video

## Delivered flow

`/dashboard/motion` lets the owner choose a ready image from the M2 library, create a named analysis job, reopen its review plan, edit up to six package/key-visual highlight rectangles, preview motion, explicitly confirm one video credit, and download the completed private MP4. Images belonging to M2 collections are available from the same library. Reloading preserves jobs and submitted plans; unsent form edits are not saved. A new video is a new immutable render request with a pinned brand revision.

MVP rendering offers a gently floating full poster or a stationary poster, plus sequential outline highlights. All poster content fits within the output with margin; no generated replacement, OCR transcription, new prices, or image cropping is performed. This is not character segmentation, independent layer animation, or generative video. It produces silent H.264/yuv420p MP4 at 24 fps, 6/10/15 seconds, in 720×1280, 720×720 or 1280×720. Browser preview is approximate; the actual MP4 is the export artifact.

## Analysis and review

The optional vision adapter uses the existing Google GenAI dependency, `GEMINI_API_KEY`, and an explicitly configured `MOTION_VISION_MODEL`. The image is normalized and bounded before submission. The prompt treats poster content as untrusted data; only a schema-bounded array of percentage rectangles is accepted. Model text, prices, URLs, and instructions are never rendered. Backend validation bounds every rectangle to the image and limits its count.

If no vision model/key is configured, the provider fails, or its response is invalid, the job opens an explicitly labelled manual plan. It does not pretend AI detection succeeded. Review requires the user to open the prepared plan, inspect it, and check confirmation before rendering. Drafts expire after 24 hours. Creation is capped at 10 per shop/hour to bound analysis requests. Analysis may cost money when a real model is configured; no live provider call was made during development verification.

## Quota and access

Apply `20260914_motion_studio.sql` after the M1 and M2 migrations to the intended development/staging database. Migration was tested only on an isolated loopback PostgreSQL database. Application and worker now require M3's migration, including the M2 active-reference checks.

`motion_entitlements` is the pilot feature gate per shop. No row, or `enabled=false`, denies creation. The migration grants no access and changes no paid plan or image quota. An operator explicitly sets `enabled` and `monthly_limit` for approved pilot shops; this is not a subscription billing integration or an admin UI. Future package mapping should supply this entitlement through the existing purchased-plan snapshot system rather than hardcoding plan prices here.

A UTC calendar-month `video_render` bucket snapshots the limit on first render submission. Later grant changes apply to the next monthly bucket; disabling the grant immediately blocks new submissions. A successful render consumes one credit; failed/cancelled work releases only its original reservation. Storage reserves 32 MiB, then adjusts to actual output bytes with an auditable resize event and settles once. Physical file deletion does not refund a successfully consumed render credit. Deleting the source or output while a motion job is active is blocked.

## Worker and failure handling

The existing external media worker processes M2 jobs and M3 jobs. Build with `npm.cmd run media:worker:build`, then start `npm.cmd run media:worker` on a persistent Node worker host with FFmpeg/libx264 and ffprobe. Set `FFMPEG_PATH` and `FFPROBE_PATH` if executables are not on PATH. No Vercel request executes FFmpeg and no worker host has been provisioned by this change.

PostgreSQL claim locks use SKIP LOCKED, a random lease token, ten-minute expiry and heartbeats. FFmpeg uses an argument array, generated local file paths, no shell, no network input, two encoder threads, a five-minute timeout and bounded output. Private storage writes have a one-minute deadline. Only the live lease may adopt the artifact and settle quota.

Each render attempt has its own generated private pathname persisted before writing. After a crash or uncertain write, a later worker waits one hour before deleting that unadopted pathname. It then retries; after three render failures and successful cleanup, it releases storage and video reservations. Cleanup failure keeps reservations and retries. This conservative grace accommodates delayed writes; staging must validate the chosen storage provider's completion behavior. Unadopted scratch outputs are tracked separately from library assets and may temporarily occupy physical storage beyond the user's final artifact size.

Cancellation is available before a worker owns the job. A live running job finishes normally; a request to cancel reports this explicitly. A job with uncertain old output waits for cleanup rather than reporting an immediate refund. Source files remain pinned until the job is terminal. M2 expiry then handles normal retained files, and original image accounting remains unchanged.

## Verification

Use the updated `scripts/media-test-server.mjs` for a disposable real PostgreSQL cluster and isolated filesystem storage. Do not run a demonstration worker concurrently with deterministic worker claim tests.

- `npm.cmd run test:motion`: validation boundaries, actual FFmpeg MP4 generation and decoded frame corner checks, authenticated APIs, ownership, manual analysis fallback, required confirmation, duplicate render submissions, reservations, lease recovery, actual private download, quota limits, failure retries/refunds and expired reviews.
- `npm.cmd run test:media`: existing M2 integration and file checks after the active-motion reference changes.
- Existing brand, prompt and application tests, lint, typecheck and production build.
- Browser review: sign up `motion-ui@example.test` on the local fixture, run `node scripts/motion-demo-access.mjs`, then `node scripts/media-test-worker.mjs`. The demo grant script is fixed to loopback and that test account; it does not read live environment files. Upload `.test-build/motion-poster.png`, create a plan, add a highlight, preview, confirm, reload and download.

Actual vision-provider accuracy, private Vercel Blob upload/download callbacks, and the external worker host still need staging verification. Local filesystem storage is not evidence of live Blob transport. No live migration, paid API call, or production deployment was performed. M4 video-frame composition is outside this module.

Browser verification reached a completed render after reload, with no console errors or horizontal overflow at 390 px. Follow-up on 2026-09-15 resolved the automated download check: Chrome successfully saved the MP4 when configured with a normal native Windows path using `node scripts/verify-motion-download.mjs motion-check`. Extended paths and mixed-separator paths used in earlier attempts failed. The application download API needed no change. The saved file is `.test-build/motion-browser-result.mp4` (17,611 bytes, H.264, 720×1280, 6 seconds); FFmpeg decoded the entire file without errors.

Follow-up also fixed output retention to start when rendering completes, rather than when the job was queued. The integration test now makes the pending output already expired before rendering and verifies a full retention window after success. The disposable test-server runner verifies PostgreSQL's data directory before applying migrations, so an occupied fixture port cannot cause it to migrate a different cluster. Startup failure returns a nonzero exit code.

Implementation references: [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output).
