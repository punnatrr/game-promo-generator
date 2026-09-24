const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  analyzeByRules,
  detectGame,
  detectIntent,
  extractProduct,
  temperatureFromScore,
} = require("../.test-build/leads/logic.js");
const {
  ManualLeadSource,
  CsvLeadSource,
} = require("../.test-build/leads/source-adapters.js");

const games = [
  { id: "valorant", slug: "valorant", name: "VALORANT", iconUrl: null, aliases: ["valorant", "valo", "วาโล", "vp"] },
  { id: "roblox", slug: "roblox", name: "Roblox", iconUrl: null, aliases: ["roblox", "robux", "โรบัค"] },
  { id: "pubg", slug: "pubg-mobile", name: "PUBG Mobile", iconUrl: null, aliases: ["pubg mobile", "pubg", "uc"] },
];

test("detects Thai game aliases", () => {
  const detected = detectGame("มีร้านเติมวาโล 1000 VP ไหมครับ", games);
  assert.equal(detected.slug, "valorant");
  assert.ok(detected.confidence >= 0.78);
});

test("classifies direct price questions", () => {
  assert.equal(detectIntent("UC 660 ราคาเท่าไหร่").intent, "ASK_PRICE");
  assert.equal(detectIntent("ร้านไหนเติมถูกกว่า").intent, "COMPARE_PRICE");
});

test("extracts product currency and amount", () => {
  assert.deepEqual(extractProduct("หาร้านเติม Valorant 1000 VP"), {
    currency: "VP",
    amount: 1000,
    package: "1000",
  });
  assert.equal(extractProduct("มีร้านเติมโรบัค 800 ไหม").currency, "ROBUX");
});

test("buyer lead scores above seller promotion", () => {
  const buyer = analyzeByRules("มีร้านเติม 1000 VP ราคาเท่าไหร่ครับ", 0.95);
  const seller = analyzeByRules("ร้านเรารับเติม Valorant โปรโมชั่นร้าน ทักร้านได้", 0.95);
  assert.ok(buyer.leadScore > seller.leadScore);
  assert.equal(seller.isSeller, true);
});

test("temperature boundaries match product requirements", () => {
  assert.equal(temperatureFromScore(80), "HOT");
  assert.equal(temperatureFromScore(60), "WARM");
  assert.equal(temperatureFromScore(40), "POSSIBLE");
  assert.equal(temperatureFromScore(39), "LOW");
});

test("manual and CSV adapters normalize authorized inputs", async () => {
  const manual = await new ManualLeadSource().normalize({ text: "ถามราคา ROV", sourceUrl: "https://example.com/post" });
  assert.equal(manual[0].text, "ถามราคา ROV");
  const csv = await new CsvLeadSource().normalize([{ text: "UC 660 ราคาเท่าไหร่", source: "CSV" }]);
  assert.equal(csv[0].sourceType, "CSV");
});
