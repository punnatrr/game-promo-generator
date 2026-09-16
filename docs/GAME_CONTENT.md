# THUNDER TOPUP Game Content

Game Content replaces the previous game-news screen with a weekly admin workflow
for discovering activities, verifying sources, prioritizing content, scheduling
posts, and producing Thai content drafts.

## Routes

- `/admin/game-tracker` — Week (default), today, month, calendar, by-game, pipeline,
  unverified, and published views.
- `/admin/game-tracker/sources` — source allowlist, credibility, language, and
  active state.
- `/game-news` — redirects to the new admin dashboard.

## Database

Run `db/migrations/20260728_game_content.sql` against `DATABASE_URL`. It adds
`games`, `game_sources`, `game_activities`, `activity_sources`,
`activity_tags`, `content_tasks`, `content_calendar`, `generated_contents`,
`activity_status_logs`, `crawler_runs`, and `system_settings`.

The existing `notifications` table is reused. The migration also adds
`users.content_role` with `VIEWER` as the default. Existing application admins
are treated as Game Content `ADMIN`.

## Environment variables

```env
DATABASE_URL=
CRON_SECRET=
GEMINI_API_KEY=
GAME_CONTENT_AI_MODEL=gemini-2.5-flash
```

`GEMINI_API_KEY` is optional. Without it, Generate Content uses a deterministic
fallback which only rearranges verified activity fields and displays
`ยังไม่มีข้อมูลยืนยัน` for missing facts.

## Cron schedule

Vercel Cron uses UTC. `vercel.json` maps Bangkok time as follows:

| Bangkok | UTC | Endpoint |
| --- | --- | --- |
| Monday 08:00 | `0 1 * * 1` | `/api/cron/game-content/weekly` |
| Month day 1, 08:00 | `0 1 1 * *` | `/api/cron/game-content/monthly` |

Cron routes require `Authorization: Bearer $CRON_SECRET`. Cron jobs run only on
production deployments. The weekly job discovers new activities first and then
builds the Weekly Content Plan.

## Source limitations

- Official websites/social: strongest verification, but Google News may not
  index every post.
- In-game announcements and app stores: manual entry is required unless a
  public API/feed is available.
- Discord/community: only public feeds are supported; private channels are not
  bypassed.
- Trusted media/community/data mining: preserve the source URL and use
  `RUMOR`, `DATAMINED`, or `UNKNOWN` warnings until officially confirmed.
- The crawler validates HTTPS URLs, blocks private/local network destinations,
  uses a 10-second timeout, and does not bypass bot protection.

## Testing

```powershell
npm.cmd run lint
npm.cmd exec -- tsc --noEmit
npm.cmd run build
```

Sign in as an admin, open `/admin/game-tracker`, add a source and activity,
change its pipeline status, generate content, and export CSV/JSON/ICS.

## Mock and production-ready areas

- The repository contains an in-memory fallback for development tests, but the
  authenticated admin APIs still require the existing database-backed login.
  Use `DATABASE_URL` for normal operation.
- With the migration and `DATABASE_URL`, games, sources, activities, status
  changes, generated content, calendar entries, and crawler runs persist.
- Automatic discovery currently relies on public Google News RSS indexing for
  configured sources. Platform-specific APIs can be added later without
  changing the dashboard contract.
