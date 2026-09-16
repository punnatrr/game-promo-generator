const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  parseFreeFireOfficialNews,
} = require("../.test-build/game-content/adapters/free-fire.js");
const {
  parseMobileLegendsManualReview,
} = require("../.test-build/game-content/adapters/mobile-legends.js");
const {
  parsePubgMobileManualReview,
} = require("../.test-build/game-content/adapters/pubg-mobile.js");
const {
  parseRobloxAnnouncementsJson,
} = require("../.test-build/game-content/adapters/roblox.js");
const {
  parseWhiteoutCenturyGamesNews,
} = require("../.test-build/game-content/adapters/whiteout-survival.js");
const {
  parseEfootballOfficialNews,
} = require("../.test-build/game-content/adapters/efootball.js");
const {
  parseFreeFireMaxOfficialNews,
} = require("../.test-build/game-content/adapters/free-fire-max.js");
const {
  parseFcMobileOfficialNews,
} = require("../.test-build/game-content/adapters/fc-mobile.js");
const {
  parseGarenaRovPatchNotes,
} = require("../.test-build/game-content/adapters/garena-rov.js");
const {
  parseDigimonUpOfficialNews,
} = require("../.test-build/game-content/adapters/digimon-up.js");
const {
  parseValorantThailandNews,
} = require("../.test-build/game-content/adapters/valorant.js");
const {
  parseCookieRunClassicManualReview,
} = require("../.test-build/game-content/adapters/cookierun-classic.js");
const {
  parseRagnarokNewWorldManualReview,
} = require("../.test-build/game-content/adapters/ragnarok-the-new-world.js");
const {
  parseKingshotManualReview,
} = require("../.test-build/game-content/adapters/kingshot.js");
const {
  parseLastWarManualReview,
} = require("../.test-build/game-content/adapters/last-war.js");
const {
  parseSoulLandAwakeningWorldManualReview,
} = require("../.test-build/game-content/adapters/soul-land-awakening-world.js");
const {
  parseHonkaiStarRailManualReview,
} = require("../.test-build/game-content/adapters/honkai-star-rail.js");
const {
  parseLoveAndDeepspaceManualReview,
} = require("../.test-build/game-content/adapters/love-and-deepspace.js");
const {
  parseGenshinImpactManualReview,
} = require("../.test-build/game-content/adapters/genshin-impact.js");
const {
  parseWutheringWavesManualReview,
} = require("../.test-build/game-content/adapters/wuthering-waves.js");
const {
  GAME_SOURCE_ADAPTERS,
} = require("../.test-build/game-content/adapters/registry.js");
const {
  DISCOVERY_LOOKBACK_DAYS,
  isFreshGameUpdate,
} = require("../.test-build/game-content/freshness.js");
const {
  GAME_CONTENT_SOCIAL_SOURCE_SEEDS,
} = require("../.test-build/game-content/social-seeds.js");
const {
  buildIndexedSocialQuery,
  deriveSocialPostTitle,
  normalizeOfficialSocialPostUrl,
} = require("../.test-build/game-content/social-post.js");
const {
  inferAdapterActivityType,
} = require("../.test-build/game-content/adapters/helpers.js");
const {
  assessGameContentAffinity,
} = require("../.test-build/game-content/game-affinity.js");
const {
  GAME_CONTENT_GAME_SEEDS,
  GAME_CONTENT_SOURCE_SEEDS,
} = require("../.test-build/game-content/seed.js");

test("Free Fire parser reads only its server-rendered news contract", () => {
  const items = parseFreeFireOfficialNews(`
    <ul>
      <li id="1681" class="news-item active">
        <a href="/th/article/1681/" class="news-link">
          <img data-src="https://example.test/free-fire.jpg">
          <span class="news-time">24/07/2026</span>
          <span class="news-category">ประกาศ</span>
          <h4 class="news-title">แพตช์ใหม่และสกินใหม่</h4>
        </a>
      </li>
    </ul>
  `);
  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "free-fire-1681");
  assert.equal(items[0].activityType, "VERSION_UPDATE");
  assert.equal(items[0].url, "https://ff.garena.com/th/article/1681/");
});

test("Roblox parser accepts staff announcement JSON and skips About topic", () => {
  const items = parseRobloxAnnouncementsJson(JSON.stringify({
    topic_list: {
      topics: [
        {
          id: 1,
          title: "About the Announcements category",
          slug: "about",
          created_at: "2026-07-28T01:00:00Z",
          pinned: true,
        },
        {
          id: 42,
          title: "New avatar item update",
          slug: "new-avatar-item-update",
          excerpt: "Official staff announcement",
          created_at: "2026-07-28T02:00:00Z",
          views: 12000,
          like_count: 120,
        },
      ],
    },
  }));
  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "roblox-topic-42");
  assert.equal(items[0].activityType, "VERSION_UPDATE");
  assert.match(items[0].url, /\/t\/new-avatar-item-update\/42$/);
});

test("Whiteout parser isolates Whiteout news from other Century games", () => {
  const items = parseWhiteoutCenturyGamesNews(`
    <div class="news-item">
      <a href="https://www.centurygames.com/whiteout-survival-wos-update/">
        <img data-lazy-src="https://example.test/wos.jpg">
      </a>
      <div class="news-item-date"><span>July 28, 2026</span></div>
      <h6 class="news-item-title"><a href="https://www.centurygames.com/whiteout-survival-wos-update/">Whiteout Survival - Update</a></h6>
    </div>
    <div class="news-item">
      <div class="news-item-date"><span>July 28, 2026</span></div>
      <h6 class="news-item-title"><a href="https://www.centurygames.com/other-game/">Other Game - Update</a></h6>
    </div>
  `);
  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "whiteout-whiteout-survival-wos-update");
  assert.equal(items[0].activityType, "VERSION_UPDATE");
});

test("Mobile Legends manual parser enforces the official host allowlist", () => {
  const item = parseMobileLegendsManualReview({
    title: "Official patch note",
    sourceUrl: "https://www.mobilelegends.com/en/news-detail/1",
    publishedAt: "2026-07-28T00:00:00Z",
  });
  assert.equal(item.tags.includes("manual-review"), true);
  const thailandPage = parseMobileLegendsManualReview({
    title: "Official Thailand event",
    sourceUrl:
      "https://www.facebook.com/MobileLegendsGameTHLA/posts/pfbid-test",
    publishedAt: "2026-08-01T00:00:00Z",
  });
  assert.equal(thailandPage.platform, "facebook");
  assert.throws(() => parseMobileLegendsManualReview({
    title: "Fake",
    sourceUrl: "https://www.facebook.com/unofficial-mlbb-page/posts/1",
    publishedAt: "2026-07-28T00:00:00Z",
  }), /official allowlist/);
});

test("official social quick import helpers preserve post identity and remove tracking", () => {
  assert.equal(
    normalizeOfficialSocialPostUrl(
      "https://www.facebook.com/ROVTH/posts/pfbid123?fbclid=tracking&__tn__=R"
    ),
    "https://www.facebook.com/ROVTH/posts/pfbid123"
  );
  assert.equal(
    deriveSocialPostTitle("\n🔴 เริ่มแล้ว Valor Pass 67! 🔴\nพบกับ 3 สกินใหม่"),
    "🔴 เริ่มแล้ว Valor Pass 67! 🔴"
  );
  assert.equal(
    buildIndexedSocialQuery(
      "Mobile Legends: Bang Bang Thailand Official Facebook",
      "https://www.facebook.com/MobileLegendsGameTHLA/",
      "Mobile Legends: Bang Bang",
      7
    ),
    '("Mobile Legends: Bang Bang Thailand" OR "MobileLegendsGameTHLA") site:www.facebook.com when:7d'
  );
  assert.equal(
    buildIndexedSocialQuery(
      "CookieRun Classic Official Instagram",
      "https://www.instagram.com/crclassic_en/",
      "CookieRun Classic",
      7
    ),
    '("CookieRun Classic" OR "crclassic_en") site:www.instagram.com when:7d'
  );
});

test("social post classification covers the supplied RoV and MLBB event patterns", () => {
  assert.equal(
    inferAdapterActivityType("Billow x Okarun มาแล้ววันนี้!", "DANDADAN"),
    "COLLABORATION"
  );
  assert.equal(
    inferAdapterActivityType("เริ่มแล้ว Valor Pass 67", "พาสและสกินใหม่"),
    "BATTLE_PASS"
  );
  assert.equal(
    inferAdapterActivityType("แสงดาวเดือนสิงหาคม", "รับสกินพิเศษ"),
    "BATTLE_PASS"
  );
  assert.equal(
    inferAdapterActivityType("กิจกรรมลิขสิทธิ์ Jujutsu Kaisen", "กลับมาแล้ว"),
    "COLLABORATION"
  );
  assert.equal(
    inferAdapterActivityType("แอบส่องสกินชุดที่สอง", "อาร์กัส ไรเด็นมารุ"),
    "NEW_SKIN"
  );
});

test("PUBG Mobile manual parser enforces the official host allowlist", () => {
  const item = parsePubgMobileManualReview({
    title: "Official update",
    sourceUrl: "https://www.pubgmobile.com/en-US/news-detail.shtml?id=1",
    publishedAt: "2026-07-28T00:00:00Z",
  });
  assert.equal(item.tags.includes("manual-review"), true);
  assert.throws(() => parsePubgMobileManualReview({
    title: "Fake",
    sourceUrl: "https://x.com/unofficial_pubg/status/1",
    publishedAt: "2026-07-28T00:00:00Z",
  }), /official allowlist/);
});

test("eFootball parser reads mobile rows and removes platform duplicates", () => {
  const rows = [
    {
      id: 5558,
      beginDate: "2026-07-28 02:00:00",
      title: "Big eFootball Update",
      category: 5,
      ios: "true",
      android: "true",
    },
    {
      id: 5559,
      beginDate: "2026-07-28 02:00:00",
      title: "Big eFootball Update",
      category: 5,
      ios: "true",
      android: "false",
    },
    {
      id: 5560,
      beginDate: "2026-07-28 03:00:00",
      title: "Console only",
      category: 4,
      ios: "false",
      android: "false",
    },
  ];
  const items = parseEfootballOfficialNews(
    `<script>const app={data(){return {newsData: ${JSON.stringify(rows)}, filteredNews: []}}}</script>`
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "efootball-5558");
  assert.equal(items[0].platform, "mobile");
});

test("Free Fire MAX parser uses the dedicated shared-client contract", () => {
  const items = parseFreeFireMaxOfficialNews(`
    <li id="1700" class="news-item active">
      <a href="/th/article/1700/" class="news-link">
        <img data-src="https://example.test/max.jpg">
        <span class="news-time">28/07/2026</span>
        <span class="news-category">ประกาศ</span>
        <h4 class="news-title">Free Fire MAX แพตช์ใหม่</h4>
      </a>
    </li>
  `);
  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "free-fire-max-1700");
  assert.equal(items[0].activityType, "VERSION_UPDATE");
});

test("FC Mobile parser reads only EA embedded newsDataFallback", () => {
  const payload = {
    props: {
      pageProps: {
        newsDataFallback: {
          items: [{
            title: "EA SPORTS FC Mobile Update",
            summary: "New item and mode",
            publishingDate: "2026-07-24T05:00:00.000-07:00",
            slug: "fc-mobile-update",
            image: { ar16X9: "https://example.test/fc.jpg" },
          }],
        },
      },
    },
  };
  const items = parseFcMobileOfficialNews(
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "fc-mobile-fc-mobile-update");
  assert.match(items[0].url, /\/news\/fc-mobile-update$/);
});

test("Garena RoV parser reads only the patch-note list", () => {
  const payload = {
    props: {
      initialProps: {
        pageProps: {
          news: [{
            title: "อัปเดตแพตช์ใหม่",
            description: "เพิ่มฮีโร่และไอเทม",
            content_image: "https://example.test/rov.jpg",
            show_datetime_text: "22 Jul 2026",
            url: "/patch-notes/hotfix220726",
            tags: [{ title: "Patch Note" }],
          }],
        },
      },
    },
  };
  const items = parseGarenaRovPatchNotes(
    `<script id="__NEXT_DATA__">${JSON.stringify(payload)}</script>`
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "rov-hotfix220726");
  assert.equal(items[0].activityType, "VERSION_UPDATE");
});

test("DIGIMON UP parser reads Bandai Namco news cards", () => {
  const items = parseDigimonUpOfficialNews(`
    <ul class="newsList"><li>
      <a href="?p=314" class="newsCard">
        <time datetime="2026-07-16">2026.07.16</time>
        <ul class="category"><li>Game Info</li></ul>
        <span class="title">DIGIMON UP Update<br>New item</span>
      </a>
    </li></ul>
  `);
  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "digimon-up-314");
  assert.equal(items[0].activityType, "VERSION_UPDATE");
});

test("VALORANT parser keeps Thai game updates and excludes Esports", () => {
  const item = {
    title: "แพตช์โน้ต VALORANT 13.02",
    publishedAt: "2026-07-28T13:00:00.000Z",
    action: { payload: { url: "/th-th/news/game-updates/patch-13-02" } },
    category: { machineName: "game_updates", title: "การอัปเดตเกม" },
    description: { body: "เพิ่มแผนที่ใหม่" },
    analytics: { contentId: "official.th-th" },
  };
  const payload = {
    props: {
      pageProps: {
        page: {
          blades: [{ items: [
            item,
            {
              ...item,
              title: "VCT",
              category: { machineName: "esports", title: "อีสปอร์ต" },
            },
          ] }],
        },
      },
    },
  };
  const items = parseValorantThailandNews(
    `<script id="__NEXT_DATA__">${JSON.stringify(payload)}</script>`
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "valorant-official.th-th");
  assert.equal(items[0].activityType, "VERSION_UPDATE");
});

test("all remaining manual adapters enforce their game-specific allowlist", () => {
  const common = {
    title: "Official event update",
    publishedAt: "2026-07-28T00:00:00Z",
  };
  const cases = [
    [parseCookieRunClassicManualReview, "https://www.facebook.com/CRClassicEN/posts/1"],
    [parseRagnarokNewWorldManualReview, "https://www.facebook.com/RagnarokTheNewWorld.Gravity/posts/1"],
    [parseKingshotManualReview, "https://www.facebook.com/61560003321785/posts/1"],
    [parseLastWarManualReview, "https://www.lastwar.com/en/news/1"],
    [parseSoulLandAwakeningWorldManualReview, "https://gevents.37games.com/official_slmsea/news/1"],
    [parseHonkaiStarRailManualReview, "https://hsr.hoyoverse.com/en-us/news/1"],
    [parseLoveAndDeepspaceManualReview, "https://loveanddeepspace.infoldgames.com/en-EN/news/20"],
    [parseGenshinImpactManualReview, "https://genshin.hoyoverse.com/en/news/detail/1"],
    [parseWutheringWavesManualReview, "https://wutheringwaves.kurogames.com/en/main/news/detail/1"],
  ];
  for (const [parser, sourceUrl] of cases) {
    assert.equal(
      parser({ ...common, sourceUrl }).tags.includes("manual-review"),
      true
    );
    assert.throws(
      () => parser({ ...common, sourceUrl: "https://example.test/fake" }),
      /official allowlist/
    );
  }
});

test("registry has one or more adapters for all 20 configured games", () => {
  const slugs = new Set(GAME_SOURCE_ADAPTERS.map((adapter) => adapter.gameSlug));
  assert.equal(GAME_SOURCE_ADAPTERS.length, 20);
  assert.equal(slugs.size, 20);
});

test("official social seeds cover every configured game without duplicate URLs", () => {
  const expectedGameSlugs = GAME_CONTENT_GAME_SEEDS.map(([slug]) => slug);
  const allowedHosts = new Set([
    "facebook.com",
    "www.facebook.com",
    "instagram.com",
    "www.instagram.com",
    "tiktok.com",
    "www.tiktok.com",
    "x.com",
    "www.x.com",
  ]);
  const gameSlugs = new Set();
  const gameUrls = new Set();
  const allSourceUrls = new Set();

  for (const source of GAME_CONTENT_SOCIAL_SOURCE_SEEDS) {
    const url = new URL(source.url);
    const uniqueKey = `${source.gameSlug}:${url.href.toLowerCase()}`;
    assert.equal(source.sourceType, "OFFICIAL_SOCIAL");
    assert.equal(source.automationMode, "MANUAL_REVIEW");
    assert.equal(source.credibilityScore, 100);
    assert.equal(url.protocol, "https:");
    assert.equal(allowedHosts.has(url.hostname), true);
    assert.equal(gameUrls.has(uniqueKey), false);
    gameUrls.add(uniqueKey);
    gameSlugs.add(source.gameSlug);
  }

  assert.deepEqual([...gameSlugs].sort(), expectedGameSlugs.sort());

  for (const source of GAME_CONTENT_SOURCE_SEEDS) {
    const uniqueKey = `${source.gameSlug}:${new URL(source.url).href.toLowerCase()}`;
    assert.equal(allSourceUrls.has(uniqueKey), false);
    allSourceUrls.add(uniqueKey);
  }
});

test("activity discovery accepts only the previous 7 days", () => {
  const now = new Date("2026-07-30T07:00:00+07:00");
  const update = (publishedAt) => ({
    publishedAt,
    title: "แพตช์และกิจกรรมใหม่",
    description: "Official update",
  });

  assert.equal(DISCOVERY_LOOKBACK_DAYS, 7);
  assert.equal(
    isFreshGameUpdate(update("2026-07-23T07:00:00+07:00"), now),
    true
  );
  assert.equal(
    isFreshGameUpdate(update("2026-07-23T06:59:59+07:00"), now),
    false
  );
  assert.equal(
    isFreshGameUpdate(update("2026-07-22T07:00:00+07:00"), now),
    false
  );
});

test("indexed social discovery rejects a clearly different tracked game", () => {
  const rovPost =
    "บัพแบบนี้หรือว่าจะมีสกินใหม่มา แต่ซาต้าไปซะแล้ว #ROV #rovthailand #RoVTH #สกินROV";
  const result = assessGameContentAffinity(
    "cookierun-classic",
    rovPost,
    "instagram.com"
  );

  assert.equal(result.affinity, "CONFLICT");
  assert.deepEqual(result.conflictingGameSlugs, ["garena-rov"]);
});

test("indexed social discovery keeps matching and ambiguous official posts", () => {
  assert.equal(
    assessGameContentAffinity(
      "garena-rov",
      "Valor Pass 67 มาแล้ว #ROVTH",
      ""
    ).affinity,
    "MATCH"
  );
  assert.equal(
    assessGameContentAffinity(
      "cookierun-classic",
      "A mysterious new costume is coming soon",
      "Official social teaser"
    ).affinity,
    "UNKNOWN"
  );
});
