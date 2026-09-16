const assert = require("node:assert/strict");
const { test } = require("node:test");
const sharp = require("sharp");
const {
  convertDailyImageToWebp,
  DailyImageValidationError,
  MAX_DAILY_IMAGE_BYTES,
} = require("../.test-build/daily-images/storage.js");

function dataUrl(bytes, format) {
  return `data:image/${format};base64,${bytes.toString("base64")}`;
}

for (const format of ["png", "jpeg", "webp"]) {
  test(`${format} uploads become bounded WebP images`, async () => {
    const input = await sharp({
      create: {
        width: 1600,
        height: 800,
        channels: 3,
        background: "#159972",
      },
    }).toFormat(format).toBuffer();
    const output = await convertDailyImageToWebp(dataUrl(input, format));
    const metadata = await sharp(output).metadata();

    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1024);
    assert.equal(metadata.height, 512);
  });
}

test("small transparent images retain transparency without enlargement", async () => {
  const input = await sharp({
    create: {
      width: 80,
      height: 120,
      channels: 4,
      background: { r: 10, g: 80, b: 160, alpha: 0.5 },
    },
  }).png().toBuffer();
  const output = await convertDailyImageToWebp(dataUrl(input, "png"));
  const metadata = await sharp(output).metadata();

  assert.equal(metadata.width, 80);
  assert.equal(metadata.height, 120);
  assert.equal(metadata.hasAlpha, true);
});

test("EXIF orientation is applied and metadata is removed", async () => {
  const input = await sharp({
    create: {
      width: 80,
      height: 120,
      channels: 3,
      background: "#159972",
    },
  }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const output = await convertDailyImageToWebp(dataUrl(input, "jpeg"));
  const metadata = await sharp(output).metadata();

  assert.equal(metadata.width, 120);
  assert.equal(metadata.height, 80);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.orientation, undefined);
});

test("corrupt images with a valid file signature are rejected", async () => {
  const corrupt = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  await assert.rejects(
    convertDailyImageToWebp(dataUrl(corrupt, "png")),
    DailyImageValidationError
  );
});

test("oversized inputs are rejected before conversion", async () => {
  const oversized = Buffer.alloc(MAX_DAILY_IMAGE_BYTES + 1, 1);
  await assert.rejects(
    convertDailyImageToWebp(dataUrl(oversized, "png")),
    /4 MB or less/
  );
});
