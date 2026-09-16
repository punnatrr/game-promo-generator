# THUNDER TOPUP Game Calendar

Game Calendar collects candidate announcements from the configured Source
Registry, places uncertain items in the review queue, and publishes only
admin-approved activities to `/game-calendar`. All displayed times use
`Asia/Bangkok`.

## Architecture

- Next.js App Router pages and route handlers.
- Existing PostgreSQL repository in `lib/game-content` remains the persistence
  layer so the previous admin workflows and data are preserved.
- `lib/game-calendar` adds calendar status calculation, deduplication, scoring,
  public projection, validation, and notification providers.
- The browser reads public APIs under `/api/game-calendar`.
- Admin mutations continue through authenticated, role-checked
  `/api/game-tracker` routes; bot history is under
  `/api/game-calendar/admin/bot-runs`.

## Setup and migration

1. Set `DATABASE_URL`, authentication settings, and `CRON_SECRET` in
   `.env.local`.
2. Apply `db/migrations/20260728_game_content.sql`.
3. Apply `db/migrations/20260728_game_calendar.sql`.
4. Apply `db/migrations/20260728_game_source_adapters.sql`.
5. Apply `db/migrations/20260729_admin_activity_review.sql`.
6. Do not apply `db/seed-game-calendar-demo.sql` in production. The file exists
   only for development UI testing; every row is `[DEMO]`, `is_demo=true`,
   `SKIPPED`, and contains no invented dates.
7. Run `npm.cmd run dev` and open `/game-calendar`.

## Routes

- `/game-calendar` — Month, Week, Agenda, List, and Timeline views.
- `/game-calendar/events/[id]` — verified event detail and all source links.
- `/admin#game-activity-review` — daily bot status, review queue, event dates,
  APPROVED action, and links to the public calendar.
- `/admin/game-tracker/games` — add, edit, activate, or remove games.
- `/admin/game-tracker/sources` — source registry and credibility settings.

Public APIs:

- `GET /api/game-calendar/events`
- `GET /api/game-calendar/events/:id`
- `GET /api/game-calendar/games`
- `GET /api/game-calendar/summary`
- `GET /api/game-calendar/latest`
- `GET /api/game-calendar/upcoming?days=7|30`
- `GET /api/game-calendar/trends`
- `GET /api/game-calendar/opportunities`

Filters include `game`, `category`, `status`, `dateFrom`, `dateTo`, `region`,
`server`, `officialOnly`, `communityTrend`, `minImportance`,
`minOpportunity`, `endingSoon`, `unconfirmed`, `q`, `page`, `limit`, and
`sort`.

## Daily bot and manual refresh

Vercel Cron schedules are UTC. `0 0 * * *` invokes
`/api/cron/game-calendar/daily` at 07:00 Bangkok every day. Vercel sends
`Authorization: Bearer $CRON_SECRET`; the endpoint rejects requests without
that exact value.

The pipeline limits concurrent source requests to five, uses an eight-second
timeout, retries each failed request once, records per-source errors, continues
when one source fails, and writes a `crawler_runs` record. Admins can run the
same pipeline from the Game Activity Bot panel in `/admin`.

Every bot result starts in `DISCOVERED` and appears in the main admin review
queue. Search-engine candidates remain `UNKNOWN` even when the configured
source is official, because the indexed URL must be checked by an admin.
APPROVED requires an event start date; the public calendar uses that date to
place the activity. Vercel Cron runs the same search daily at 07:00 Bangkok.

## Adding a source or parser

Add sources in `/admin/game-tracker/sources`; do not hardcode new production
events. URLs must be public HTTPS URLs and pass the private-network/localhost
SSRF checks. Use only public APIs or feeds permitted by the provider.

To add a parser:

1. Add a provider module under `lib/game-content`.
2. Return normalized title, source URL, publication time, update type, and raw
   excerpt only when necessary.
3. Preserve the external post ID where available.
4. Enforce provider terms, timeout, retry, and incremental cursor/ETag rules.
5. Never bypass login, CAPTCHA, robots, or anti-bot controls.

The adapter registry is in `lib/game-content/adapters`. Each supported provider
has a parser for its own documented or server-rendered response shape. It does
not share a global CSS selector across unrelated sites.

Current first-wave sources:

| Game | Official source | Mode | Constraint |
| --- | --- | --- | --- |
| Mobile Legends: Bang Bang | `mobilelegends.com/en/news`, official Facebook | Manual Review | News is loaded through an undocumented internal dynamic API; social pages do not expose a stable public feed. |
| Free Fire | `ff.garena.com/th/news/` | Adapter | Parses the Thai server-rendered Garena news list. |
| Roblox | DevForum `updates/announcements/36.json` | Adapter | Reads only the Announcements category where only Roblox staff can create topics. |
| PUBG Mobile | `pubgmobile.com/en-US/news.shtml` | Manual Review | The page uses an undocumented signed internal API. The application does not reproduce its signature or bypass protection. |
| Whiteout Survival | Century Games `games/a/` | Adapter | Keeps only developer news whose title identifies Whiteout Survival; official Facebook remains Manual Review. |

The generic Google News discovery connector remains available for older
registered sources that have not yet received a provider adapter. New sources
created by an admin default to Manual Review so an arbitrary site is never
silently treated as a reliable automatic feed.

## Review and data safety

- Public pages include only `APPROVED`, `PLANNED`, `DESIGNING`, `SCHEDULED`, or
  `PUBLISHED` activities that do not require review.
- `RUMOR`, `DATAMINED`, `UNKNOWN`, and confidence below 70 remain private.
- Missing start/end dates stay null and are shown as “ยังไม่ประกาศวัน”.
- Official sources take precedence during merges. Other source URLs are retained
  and date conflicts display a warning.
- External content is rendered as text. Source URLs are validated and no remote
  script is executed.

## Notifications

`lib/game-calendar/notifications.ts` defines the provider interface. The first
provider writes in-app notifications to existing admin users. Email, LINE,
Discord, and Telegram can implement the same `NotificationProvider` interface
without changing the bot.

## Verification

```powershell
npm.cmd run lint
npm.cmd exec -- tsc --noEmit
npm.cmd test
npm.cmd run build
node tests/live-game-source-adapters.cjs
node tests/game-calendar-db-e2e.cjs
```

After the checks, sign in as an admin, open the Game Activity Bot section in
`/admin`, review a real source, set the event start date, approve it, verify it
appears on that date in the public calendar, and open its detail page.
