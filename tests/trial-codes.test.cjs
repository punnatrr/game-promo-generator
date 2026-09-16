const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  hashTrialCode,
  isValidTrialCode,
  normalizeTrialCode,
} = require("../.test-build/trial/codes.js");

test("trial codes are normalized before lookup", () => {
  assert.equal(normalizeTrialCode("  lazy-free_10  "), "LAZY-FREE_10");
});

test("trial code validation rejects unsafe values", () => {
  assert.equal(isValidTrialCode("LAZYFREE10"), true);
  assert.equal(isValidTrialCode("ABC"), false);
  assert.equal(isValidTrialCode("CODE WITH SPACE"), false);
  assert.equal(isValidTrialCode("<SCRIPT>"), false);
});

test("trial codes use a deterministic SHA-256 hash", () => {
  assert.equal(hashTrialCode("LAZYFREE10").length, 64);
  assert.equal(
    hashTrialCode("LAZYFREE10"),
    hashTrialCode(normalizeTrialCode(" lazyfree10 "))
  );
});
