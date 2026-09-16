import type { ContentPriority } from "./types";

export function clampScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export function calculateContentPriority({
  popularityScore,
  monetizationScore,
  urgencyScore,
}: {
  popularityScore: number;
  monetizationScore: number;
  urgencyScore: number;
}) {
  const score = Math.round(
    clampScore(popularityScore) * 0.4 +
      clampScore(monetizationScore) * 0.35 +
      clampScore(urgencyScore) * 0.25
  );

  let level: ContentPriority = "LOW";
  if (score >= 80) level = "URGENT";
  else if (score >= 65) level = "HIGH";
  else if (score >= 40) level = "MEDIUM";

  return { score, level };
}

