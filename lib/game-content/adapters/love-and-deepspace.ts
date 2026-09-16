import { buildManualReviewItem } from "./helpers";
import type {
  GameSourceAdapter,
  ManualReviewInput,
  SourceAdapterItem,
} from "./types";

export function parseLoveAndDeepspaceManualReview(
  input: ManualReviewInput
): SourceAdapterItem {
  const source = new URL(input.sourceUrl);
  if (
    source.protocol !== "https:" ||
    source.hostname !== "loveanddeepspace.infoldgames.com" ||
    !source.pathname.startsWith("/en-EN/")
  ) {
    throw new Error(
      "Love and Deepspace manual source is not on the official allowlist"
    );
  }
  return buildManualReviewItem({
    gameSlug: "love-and-deepspace",
    externalIdPrefix: "love-and-deepspace-manual",
    input,
    source,
  });
}

export const loveAndDeepspaceManualAdapter: GameSourceAdapter = {
  key: "love-and-deepspace-manual",
  gameSlug: "love-and-deepspace",
  mode: "MANUAL_REVIEW",
  limitationNote:
    "หน้า News ปัจจุบันไม่มี list endpoint แบบสาธารณะที่เสถียรและบาง locale ตอบ 404 จึงให้ Admin ตรวจบทความ Official รายชิ้น",
  async fetch() {
    return { mode: this.mode, items: [], limitationNote: this.limitationNote };
  },
};
