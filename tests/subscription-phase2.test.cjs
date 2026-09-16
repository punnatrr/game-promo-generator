const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  MAX_PAYMENT_PROOF_BYTES,
  validatePaymentProof,
} = require("../.test-build/payments/proof-storage.js");

test("payment proofs are detected from file signatures, not browser MIME", () => {
  assert.deepEqual(
    validatePaymentProof(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])),
    { contentType: "image/jpeg", extension: "jpg" }
  );
  assert.deepEqual(
    validatePaymentProof(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    { contentType: "image/png", extension: "png" }
  );
  assert.throws(() => validatePaymentProof(Uint8Array.from([1, 2, 3])));
  assert.throws(() => validatePaymentProof(new Uint8Array(MAX_PAYMENT_PROOF_BYTES + 1)));
});
