const assert = require("node:assert/strict");

const {
  GAME_SOURCE_ADAPTERS,
} = require("../.test-build/game-content/adapters/registry.js");

const sourceUrls = {
  "mobile-legends-manual": "https://www.mobilelegends.com/en/news",
  "free-fire-official-news": "https://ff.garena.com/th/news/",
  "roblox-devforum-announcements":
    "https://devforum.roblox.com/c/updates/announcements/36.json",
  "pubg-mobile-manual": "https://www.pubgmobile.com/en-US/news.shtml",
  "whiteout-century-games-news": "https://www.centurygames.com/games/a/",
};

async function main() {
  const results = [];
  for (const adapter of GAME_SOURCE_ADAPTERS) {
    const source = {
      id: `live-${adapter.key}`,
      gameId: adapter.gameSlug,
      gameName: adapter.gameSlug,
      name: adapter.key,
      url: sourceUrls[adapter.key],
      sourceType: "OFFICIAL_WEBSITE",
      credibilityScore: 100,
      language: "en",
      isActive: true,
      adapterKey: adapter.key,
      automationMode: adapter.mode,
      limitationNote: adapter.limitationNote,
      lastCheckedAt: null,
      lastError: null,
    };
    const result = await adapter.fetch(source);
    assert.equal(result.mode, adapter.mode);
    if (adapter.mode === "ADAPTER") {
      assert.ok(result.items.length > 0, `${adapter.key} returned no items`);
      for (const item of result.items) {
        assert.equal(new URL(item.url).protocol, "https:");
        assert.ok(item.title);
        assert.ok(item.publishedAt);
      }
    } else {
      assert.equal(result.items.length, 0);
      assert.ok(result.limitationNote);
    }
    results.push(`${adapter.key}: ${result.mode} (${result.items.length})`);
  }
  process.stdout.write(`${results.join("\n")}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
