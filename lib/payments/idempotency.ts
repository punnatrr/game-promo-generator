const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export function normalizeIdempotencyKey(value: string | null) {
  const key = value?.trim() || "";
  return IDEMPOTENCY_KEY_PATTERN.test(key) ? key : null;
}
