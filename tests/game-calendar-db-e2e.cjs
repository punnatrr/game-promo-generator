const assert = require("node:assert/strict");
const { createHash, randomBytes, randomUUID } = require("node:crypto");
const { loadEnvConfig } = require("@next/env");
const postgres = require("postgres");

loadEnvConfig(process.cwd());

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for the database E2E test");
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });
const runId = randomUUID();
const email = `game-calendar-e2e-${runId}@example.invalid`;
const title = `[E2E DELETE ME] Adapter pipeline ${runId}`;
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const cookieName = process.env.AUTH_SESSION_COOKIE_NAME || "lazyai_session";
const cookie = `${cookieName}=${token}`;
let activityId = null;
let userId = null;

async function jsonRequest(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.auth === false ? {} : { cookie }),
      ...init.headers,
    },
  });
  const body = await response.json();
  assert.equal(
    response.ok,
    true,
    `${init.method || "GET"} ${path} failed (${response.status}): ${JSON.stringify(body)}`
  );
  return body;
}

async function main() {
  const publicGames = await jsonRequest("/api/game-calendar/games", {
    auth: false,
  });
  const freeFire = publicGames.games.find((game) => game.slug === "free-fire");
  assert.ok(freeFire, "Free Fire seed game must exist");

  const [user] = await sql`
    insert into users (
      email, display_name, role, content_role
    )
    values (
      ${email}, 'Game Calendar E2E', 'admin', 'ADMIN'
    )
    returning id
  `;
  userId = user.id;
  await sql`
    insert into user_sessions (user_id, token_hash, expires_at)
    values (${userId}, ${tokenHash}, now() + interval '1 hour')
  `;

  const registry = await jsonRequest("/api/game-tracker/sources");
  const sourceByUrl = new Map(
    registry.sources.map((source) => [source.url, source])
  );
  const freeFireSource = sourceByUrl.get("https://ff.garena.com/th/news/");
  const robloxSource = sourceByUrl.get(
    "https://devforum.roblox.com/c/updates/announcements/36.json"
  );
  const whiteoutSource = sourceByUrl.get(
    "https://www.centurygames.com/games/a/"
  );
  const mlbbSource = sourceByUrl.get(
    "https://www.mobilelegends.com/en/news"
  );
  const pubgSource = sourceByUrl.get(
    "https://www.pubgmobile.com/en-US/news.shtml"
  );
  assert.equal(freeFireSource?.automationMode, "ADAPTER");
  assert.equal(robloxSource?.automationMode, "ADAPTER");
  assert.equal(whiteoutSource?.automationMode, "ADAPTER");
  assert.equal(mlbbSource?.automationMode, "MANUAL_REVIEW");
  assert.equal(pubgSource?.automationMode, "MANUAL_REVIEW");

  const liveSourceTest = await jsonRequest(
    `/api/game-tracker/sources/${freeFireSource.id}/test`,
    { method: "POST" }
  );
  assert.equal(liveSourceTest.result.mode, "ADAPTER");

  const manualSourceTest = await jsonRequest(
    `/api/game-tracker/sources/${mlbbSource.id}/test`,
    { method: "POST" }
  );
  assert.equal(manualSourceTest.result.mode, "MANUAL_REVIEW");
  assert.ok(manualSourceTest.result.limitationNote);

  const startsAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const payload = {
    gameId: freeFire.id,
    title,
    originalTitle: title,
    activityType: "NEW_SKIN",
    description: "Temporary end-to-end record used to verify the full calendar pipeline.",
    announcementDate: new Date().toISOString(),
    region: "TH",
    platform: "Mobile",
    sourceName: "Free Fire Official Thailand",
    sourceUrl: `https://ff.garena.com/th/article/e2e-${runId}/`,
    sourceType: "OFFICIAL_WEBSITE",
    sourcePublishedAt: new Date().toISOString(),
    verificationStatus: "OFFICIAL",
    confidenceScore: 100,
    popularityScore: 80,
    monetizationScore: 70,
    urgencyScore: 60,
    tags: ["e2e", "delete-me"],
  };

  const first = await jsonRequest("/api/game-tracker/activities", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  activityId = first.activity.id;

  const duplicate = await jsonRequest("/api/game-tracker/activities", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  assert.equal(duplicate.activity.id, activityId, "duplicate must reuse the activity");

  const [dedup] = await sql`
    select
      count(*)::int as activity_count,
      (
        select count(*)::int
        from activity_sources
        where activity_id = ${activityId}
      ) as source_count
    from game_activities
    where title = ${title}
  `;
  assert.equal(dedup.activity_count, 1, "only one activity may be stored");
  assert.equal(dedup.source_count, 1, "duplicate source URL must not be stored twice");

  const missingDateResponse = await fetch(
    `${baseUrl}/api/game-tracker/activities/${activityId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        status: "APPROVED",
        verificationStatus: "OFFICIAL",
      }),
    }
  );
  assert.equal(
    missingDateResponse.status,
    400,
    "approval without a calendar date must be rejected"
  );

  const approved = await jsonRequest(
    `/api/game-tracker/activities/${activityId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "APPROVED",
        startDate: startsAt,
        verificationStatus: "OFFICIAL",
        confidenceScore: 100,
        note: "E2E approval verification",
      }),
    }
  );
  assert.equal(approved.activity.status, "APPROVED");

  const [approvalLog] = await sql`
    select count(*)::int as count
    from activity_status_logs
    where activity_id = ${activityId}
      and previous_status = 'DISCOVERED'
      and new_status = 'APPROVED'
  `;
  assert.equal(approvalLog.count, 1, "approval must create a status log");

  const calendar = await jsonRequest(
    `/api/game-calendar/events?q=${encodeURIComponent(runId)}`,
    { auth: false }
  );
  assert.equal(calendar.items.length, 1, "approved activity must be public");
  assert.equal(calendar.items[0].id, activityId);
  assert.equal(calendar.items[0].gameSlug, "free-fire");

  const deleted = await jsonRequest(
    `/api/game-tracker/activities/${activityId}`,
    { method: "DELETE" }
  );
  assert.equal(deleted.deleted, true);
  activityId = null;

  const [remaining] = await sql`
    select count(*)::int as count
    from game_activities
    where title = ${title}
  `;
  assert.equal(remaining.count, 0, "temporary activity must be removed");

  process.stdout.write(
    "DB E2E passed: create -> persist -> deduplicate -> approve -> public calendar -> cleanup\n"
  );
}

main()
  .catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (activityId) {
      await sql`delete from game_activities where id = ${activityId}`;
    }
    await sql`delete from game_activities where title = ${title}`;
    if (userId) {
      await sql`delete from users where id = ${userId}`;
    } else {
      await sql`delete from users where email = ${email}`;
    }
    await sql.end();
  });
