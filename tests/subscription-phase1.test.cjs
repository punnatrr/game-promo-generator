const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  normalizeIdempotencyKey,
} = require("../.test-build/payments/idempotency.js");
const {
  checkImageQuota,
} = require("../.test-build/subscription/quota.js");

const planSnapshot = {
  slug: "pro",
  name: "Pro",
  description: "Purchased entitlement snapshot",
  priceMonthlyThb: 499,
  monthlyImageLimit: 30,
  hasSpecialFeatures: true,
  hasVipSupport: false,
  historyRetentionDays: 30,
  maxImagesPerGeneration: 5,
};

test("idempotency keys accept UUIDs and reject unsafe or short values", () => {
  assert.equal(
    normalizeIdempotencyKey(" 550e8400-e29b-41d4-a716-446655440000 "),
    "550e8400-e29b-41d4-a716-446655440000"
  );
  assert.equal(normalizeIdempotencyKey("short"), null);
  assert.equal(normalizeIdempotencyKey("unsafe key with spaces"), null);
  assert.equal(normalizeIdempotencyKey(null), null);
});

test("quota checks use the purchased plan snapshot values", () => {
  assert.deepEqual(
    checkImageQuota({
      plan: planSnapshot,
      subscriptionStatus: "active",
      usedImagesThisPeriod: 27,
      requestedImages: 3,
      currentPeriodEnd: new Date("2026-09-01T00:00:00Z"),
      now: new Date("2026-08-01T00:00:00Z"),
    }),
    {
      allowed: true,
      remainingImages: 3,
      billableImageCount: 3,
    }
  );
});
