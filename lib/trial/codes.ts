import { createHash } from "node:crypto";

const TRIAL_CODE_PATTERN = /^[A-Z0-9_-]{4,64}$/;

export function normalizeTrialCode(value: string) {
  return value.trim().toUpperCase();
}

export function isValidTrialCode(value: string) {
  return TRIAL_CODE_PATTERN.test(value);
}

export function hashTrialCode(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
