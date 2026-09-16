import { buildManualReviewItem } from "./helpers";
import type {
  GameSourceAdapter,
  ManualReviewInput,
  SourceAdapterItem,
} from "./types";

export function parseHonkaiStarRailManualReview(
  input: ManualReviewInput
): SourceAdapterItem {
  const source = new URL(input.sourceUrl);
  if (
    source.protocol !== "https:" ||
    source.hostname !== "hsr.hoyoverse.com" ||
    !source.pathname.startsWith("/en-us/")
  ) {
    throw new Error(
      "Honkai: Star Rail manual source is not on the official allowlist"
    );
  }
  return buildManualReviewItem({
    gameSlug: "honkai-star-rail",
    externalIdPrefix: "honkai-star-rail-manual",
    input,
    source,
  });
}

export const honkaiStarRailManualAdapter: GameSourceAdapter = {
  key: "honkai-star-rail-manual",
  gameSlug: "honkai-star-rail",
  mode: "MANUAL_REVIEW",
  limitationNote:
    "หน้า HoYoverse โหลดข่าวผ่านบริการภายในที่ไม่มี public contract จึงไม่เรียก endpoint ภายในและให้ Admin ตรวจวันกิจกรรมจากบทความ Official",
  async fetch() {
    return { mode: this.mode, items: [], limitationNote: this.limitationNote };
  },
};
