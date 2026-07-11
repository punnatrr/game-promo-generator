import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAspectRatio,
  normalizeImageModel,
  normalizeImageQuality,
  openAIImageSize,
  promptAspectRatio,
  providerAspectRatio,
} from "../lib/generation/config.ts";

test("normalizers preserve supported values and apply stable defaults", () => {
  assert.equal(normalizeAspectRatio("4:5"), "4:5");
  assert.equal(normalizeAspectRatio("invalid"), "1:1");
  assert.equal(normalizeImageModel("gpt-image-2"), "gpt-image-2");
  assert.equal(normalizeImageModel("invalid"), "gpt-image-1.5");
  assert.equal(normalizeImageQuality("high"), "high");
  assert.equal(normalizeImageQuality("invalid"), "medium");
});

test("provider-specific aspect ratio behavior remains unchanged", () => {
  assert.equal(providerAspectRatio("4:5"), "3:4");
  assert.equal(providerAspectRatio("9:16"), "9:16");
  assert.equal(openAIImageSize("1:1"), "1024x1024");
  assert.equal(openAIImageSize("3:4"), "auto");
});

test("every supported ratio has a detailed prompt", () => {
  for (const ratio of ["1:1", "3:4", "4:5", "9:16", "4:3", "16:9"]) {
    assert.match(promptAspectRatio(ratio), new RegExp(ratio.replace(":", ":")));
  }
});
