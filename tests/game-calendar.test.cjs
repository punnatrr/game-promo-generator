const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");

const {
  buildDeduplicationKey,
  calculateCalendarStatus,
  mergeCalendarEvents,
} = require("../.test-build/game-calendar/logic.js");
const {
  readCalendarFilters,
} = require("../.test-build/game-calendar/validation.js");
const {
  parseGoogleNewsRss,
} = require("../.test-build/game-content/rss.js");
const {
  calculateContentPriority,
  clampScore,
} = require("../.test-build/game-content/scoring.js");
const {
  isAuthorizedCron,
} = require("../.test-build/game-content/cron.js");

function event(overrides = {}) {
  return {
    id: "community",
    deduplicationKey: "game|event|2026-07-29||",
    isOfficial: false,
    sourceUrls: ["https://community.example/event"],
    communitySourceUrls: ["https://community.example/event"],
    startDate: "2026-07-29T00:00:00+07:00",
    endDate: null,
    confidenceScore: 65,
    conflictWarning: null,
    ...overrides,
  };
}

test("status calculation uses Bangkok calendar day", () => {
  const status = calculateCalendarStatus(
    {
      startDate: "2026-07-28T00:30:00+07:00",
      endDate: "2026-07-29T00:00:00+07:00",
      announcementDate: "2026-07-27T12:00:00+07:00",
      isRumor: false,
      requiresReview: false,
    },
    new Date("2026-07-27T18:00:00Z")
  );
  assert.equal(status, "STARTS_TODAY");
});

test("status identifies upcoming, ending soon, ended, and missing dates", () => {
  const now = new Date("2026-07-28T00:00:00Z");
  const base = {
    announcementDate: null,
    isRumor: false,
    requiresReview: false,
  };
  assert.equal(
    calculateCalendarStatus(
      { ...base, startDate: "2026-08-01T00:00:00Z", endDate: null },
      now
    ),
    "UPCOMING"
  );
  assert.equal(
    calculateCalendarStatus(
      {
        ...base,
        startDate: "2026-07-01T00:00:00Z",
        endDate: "2026-07-30T00:00:00Z",
      },
      now
    ),
    "ENDING_SOON"
  );
  assert.equal(
    calculateCalendarStatus(
      {
        ...base,
        startDate: "2026-07-01T00:00:00Z",
        endDate: "2026-07-20T00:00:00Z",
      },
      now
    ),
    "ENDED"
  );
  assert.equal(
    calculateCalendarStatus(
      { ...base, startDate: null, endDate: null },
      now
    ),
    "UNSCHEDULED"
  );
});

test("rumor never becomes a factual public status", () => {
  assert.equal(
    calculateCalendarStatus({
      startDate: "2026-08-01T00:00:00Z",
      endDate: null,
      announcementDate: null,
      isRumor: true,
      requiresReview: true,
    }),
    "UNCONFIRMED"
  );
});

test("deduplication normalizes title and preserves dates/version", () => {
  const first = buildDeduplicationKey({
    gameId: "game-1",
    title: "  NEW   SKIN ",
    startDate: "2026-08-01T10:00:00Z",
    endDate: null,
    version: "V1.2",
  });
  const second = buildDeduplicationKey({
    gameId: "game-1",
    title: " new skin ",
    startDate: "2026-08-01T00:00:00+07:00",
    endDate: null,
    version: "v1.2",
  });
  assert.equal(first, second);
});

test("merge keeps official data, all sources, and date conflict warning", () => {
  const merged = mergeCalendarEvents([
    event(),
    event({
      id: "official",
      isOfficial: true,
      sourceUrls: ["https://official.example/event"],
      communitySourceUrls: [],
      officialSourceUrl: "https://official.example/event",
      startDate: "2026-07-30T00:00:00+07:00",
      confidenceScore: 100,
    }),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "official");
  assert.equal(merged[0].sourceUrls.length, 2);
  assert.equal(merged[0].confidenceScore, 100);
  assert.match(merged[0].conflictWarning, /วันเวลาไม่ตรงกัน/);
});

test("scoring clamps values and returns an explainable priority level", () => {
  assert.equal(clampScore(150), 100);
  assert.equal(clampScore(-2), 0);
  assert.deepEqual(
    calculateContentPriority({
      popularityScore: 90,
      monetizationScore: 90,
      urgencyScore: 90,
    }),
    { score: 90, level: "URGENT" }
  );
});

test("RSS parser classifies update and rejects malformed items safely", () => {
  const items = parseGoogleNewsRss(`
    <rss><channel>
      <item>
        <title><![CDATA[New Skin Arrives - Official]]></title>
        <link>https://example.com/news/1</link>
        <pubDate>Tue, 28 Jul 2026 00:00:00 GMT</pubDate>
        <description><![CDATA[See the new skin in game.]]></description>
        <source>Official</source>
      </item>
      <item><title>Missing URL</title><pubDate>invalid</pubDate></item>
    </channel></rss>
  `);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "New Skin Arrives");
  assert.equal(items[0].updateType, "skin");
});

test("API query validation clamps pagination and rejects unknown enums", () => {
  const filters = readCalendarFilters(
    new URL(
      "https://example.test/api?limit=999&page=-3&category=FAKE&status=ACTIVE&upcomingDays=7"
    )
  );
  assert.equal(filters.limit, 100);
  assert.equal(filters.page, 1);
  assert.equal(filters.category, undefined);
  assert.equal(filters.status, "ACTIVE");
  assert.equal(filters.upcomingDays, 7);
});

const previousCronSecret = process.env.CRON_SECRET;
afterEach(() => {
  if (previousCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousCronSecret;
});

test("Cron permission requires the configured bearer secret", () => {
  process.env.CRON_SECRET = "unit-test-secret";
  assert.equal(
    isAuthorizedCron(
      new Request("https://example.test", {
        headers: { authorization: "Bearer unit-test-secret" },
      })
    ),
    true
  );
  assert.equal(
    isAuthorizedCron(
      new Request("https://example.test", {
        headers: { authorization: "Bearer wrong" },
      })
    ),
    false
  );
});
