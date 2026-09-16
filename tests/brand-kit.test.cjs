const assert = require("node:assert/strict");
const { test } = require("node:test");
const { EMPTY_BRAND, validateBrandSave } = require("../.test-build/brand/model.js");
const input = () => ({ version: 0, profile: structuredClone({ ...EMPTY_BRAND, shopName: "ร้านทดสอบ" }) });
const sharp = require("sharp");
const { normalizeBrandLogo, MAX_LOGO_BYTES } = require("../.test-build/brand/logo.js");

test("logos are bounded WebP files with transparency, no enlargement or metadata", async () => {
  const input = await sharp({ create: { width: 800, height: 400, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.5 } } }).png().toBuffer();
  const output = await normalizeBrandLogo(input);
  const meta = await sharp(output).metadata();
  assert.equal(meta.format, "webp"); assert.equal(meta.width, 512); assert.equal(meta.height, 256); assert.equal(meta.hasAlpha, true); assert.equal(meta.exif, undefined);
  const small = await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).png().toBuffer();
  assert.equal((await sharp(await normalizeBrandLogo(small)).metadata()).width, 20);
});
test("logos reject oversized bytes, corrupt files and SVG content", async () => {
  await assert.rejects(normalizeBrandLogo(Buffer.alloc(MAX_LOGO_BYTES + 1)));
  await assert.rejects(normalizeBrandLogo(Buffer.from([0xff, 0xd8, 0xff, 0])));
  await assert.rejects(normalizeBrandLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')));
});

test("brand supports progressive setup without inventing payment or trust claims", () => {
  const { profile, version } = validateBrandSave(input());
  assert.equal(version, 0);
  assert.deepEqual(profile.paymentMethods, []);
  assert.deepEqual(profile.trustStatements, []);
  assert.equal(profile.logoId, null);
});
test("brand rejects blank names, invalid versions and unsafe contacts", () => {
  for (const version of [-1, 0.5, "0", null]) assert.throws(() => validateBrandSave({ ...input(), version }));
  const body = input(); body.profile.shopName = "  ";
  assert.throws(() => validateBrandSave(body));
  for (const value of ["javascript:alert(1)", "http://example.com", "https://user:secret@example.com", "not a url"]) {
    const body = input(); body.profile.contacts.website = value;
    assert.throws(() => validateBrandSave(body));
  }
});
test("claims require explicit confirmation and remain owner statements", () => {
  const body = input(); body.profile.trustStatements = ["เปิด 09:00–18:00"];
  assert.throws(() => validateBrandSave(body));
  body.profile.claimsConfirmed = true;
  assert.deepEqual(validateBrandSave(body).profile.trustStatements, body.profile.trustStatements);
  body.profile.trustStatements = Array(6).fill("claim");
  assert.throws(() => validateBrandSave(body));
});
test("brand strips unknown ownership fields and deduplicates payments", () => {
  const body = input(); body.profile.shopId = "other-shop"; body.userId = "other-user";
  body.profile.paymentMethods = ["PromptPay", "PromptPay"];
  const result = validateBrandSave(body);
  assert.equal(result.profile.shopId, undefined);
  assert.equal(result.userId, undefined);
  assert.deepEqual(result.profile.paymentMethods, ["PromptPay"]);
});
test("brand bounds text and colors and rejects malformed logos", () => {
  for (const [key, value] of [["shopName", "x".repeat(101)], ["primaryColor", "red"], ["logoId", "../../private"], ["tone", "invented"], ["defaultCta", "a\u0000b"]]) {
    const body = input(); body.profile[key] = value;
    assert.throws(() => validateBrandSave(body));
  }
});
