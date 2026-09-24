# LAZY-AI.GAME — Creator Studio redesign

## Product direction

The landing experience is the creation tool itself. Sign-up opens `/`; sign-in honors an explicit safe `next` route, then the last allowlisted creator route, then `/`. Account and usage are secondary management screens.

Top navigation: Create / Library / Calendar. Feature tabs: promotional image / video from image (the existing Motion renderer) / framed video / ad plan. Brand, package, payment, support and admin links live in the account menu. No unsupported Broadcast or duplicate video feature was added.

## Audit and implemented changes

| Previous friction | Implemented experience |
| --- | --- |
| Dashboard and account information competed with creation | Creator tools have their own shared Studio shell; account retains a management form |
| Separate forms, quota cards, step labels and history grids | Input at left, larger preview/result at right, quiet quota near the primary action, recent work in a horizontal strip |
| Media had to be uploaded on another page | Image/clip uploader in the Studio uses existing ticket, validation and storage APIs |
| Motion settings could be replaced by the prepared plan | Duration, aspect ratio and effect survive draft preparation; detected boxes are used when no custom boxes were entered |
| Frame creation required another click to obtain the first preview | Preparing or reopening a review loads the first frame preview automatically; edits invalidate confirmation until refreshed |
| Results were accessible primarily from history | Completed MP4 plays in the main canvas with download, another version and library actions |
| Library reuse required navigation and reselection | Ready images link directly to `/dashboard/motion?asset=...` |
| Large vertical poster could extend beyond the working area | Canvas image is contained in a bounded viewport; desktop long settings and results scroll within their panels |
| Image settings were long radio lists | Size and result count are compact selects; model, quality and brand controls remain available in advanced settings |
| Uneven contrast, form labels and recovery behavior | Shared tokens, focus states, labelled fields, loading/error/retry states; history API failure preserves local history |

Desktop: `top nav → feature tabs → 420–440px settings | flexible canvas → recent strip`.
Mobile: `top nav → scrolling feature tabs → inputs → primary action → preview/result → recent strip`.

## Shared components

- `app/components/layout/app-shell.tsx`: top navigation and account menu, route memory.
- `app/components/creator/creator-shell.tsx`: shell, feature tabs, workspace, settings panel, canvas, primary action, generation states and video result actions.
- `app/components/creator/asset-picker.tsx`: direct validated media upload and reusable library selection.
- `app/components/ui/workspace.tsx`: management page headings, empty/loading states, badges and payment steps.
- `app/globals.css`: colors, typography, spacing, focus, responsive Studio and management styles.

## Existing contracts preserved

Generation/refinement, model/quality/count values, daily references, browser history, Brand Kit, subscriptions, payment review, support, calendar and admin API contracts remain in use. No production database migration, deployment or environment overwrite was performed for this redesign.

Motion exposes only the renderer's supported `float` and `still` effects, 6/10/15 seconds, and 9:16 / 1:1 / 16:9. Review confirmation, revision checks and quota charging are still enforced by the existing server. Upload percentage is actual transfer progress; render states come from the job API. Video outputs already save to the library automatically. Promotional images retain the existing image-history storage behavior.

## Verification

- Lint and TypeScript checks.
- Production build, including all 80 static page entries.
- `scripts/verify-ux.mjs`: real sign-up → Studio; brand version save; ad plan save/acknowledgement/download; 22 routes at 1440px and 390px; actual input/canvas geometry; no horizontal page overflow or Next error overlay; account menu Escape/focus; image request payload and local history recovery.
- `scripts/verify-creator-studio.mjs`: actual upload, media worker, preserved settings, review, FFmpeg MP4, downloaded metadata (720×720, 6 seconds), another version, library reuse, returning sign-in, frame preview and real framed MP4.
- Both browser suites reported no page runtime errors.
- Earlier regression checks in this task: 41 core tests, 4 prompt tests, 7 Brand Kit tests, 3 ad planner tests and 3 Meta export tests passed.

The browser suites use `scripts/media-test-server.mjs`: disposable loopback PostgreSQL and local test storage. They check the cluster path before any test writes. `verify-ux` intercepts paid image generation to verify the UI/request contract without purchasing a generation; it does not establish live provider output quality. Video testing uses real local FFmpeg. Production credentials/services were not used for browser mutations.

Artifacts: `.test-build/ux/report.json`, `.test-build/ux/*.png`, `.test-build/studio/report.json`, `.test-build/studio/*-desktop.png`, `.test-build/studio/motion-result-mobile.png`, `.test-build/studio/motion-result.mp4` (ignored generated files).

To repeat: start the isolated test server, run `node scripts/ux-test-fixture.mjs` to apply the additional management fixture schemas, run `npm.cmd run media:worker:build`, then run both verification scripts with Playwright available through the local tooling's `NODE_PATH`.
