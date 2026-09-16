import { buildManualReviewItem } from "./helpers";
import type {
  GameSourceAdapter,
  ManualReviewInput,
  SourceAdapterItem,
} from "./types";

export function parseRagnarokNewWorldManualReview(
  input: ManualReviewInput
): SourceAdapterItem {
  const source = new URL(input.sourceUrl);
  if (
    source.protocol !== "https:" ||
    source.hostname !== "www.facebook.com" ||
    !source.pathname.toLowerCase().startsWith(
      "/ragnarokthenewworld.gravity"
    )
  ) {
    throw new Error(
      "Ragnarok: The New World manual source is not on the official allowlist"
    );
  }
  return buildManualReviewItem({
    gameSlug: "ragnarok-the-new-world",
    externalIdPrefix: "ragnarok-new-world-manual",
    input,
    source,
    platform: "facebook",
  });
}

export const ragnarokNewWorldManualAdapter: GameSourceAdapter = {
  key: "ragnarok-the-new-world-manual",
  gameSlug: "ragnarok-the-new-world",
  mode: "MANUAL_REVIEW",
  limitationNote:
    "ข่าวหลักอยู่บน Facebook Official ของ Gravity ซึ่งไม่มี public feed ที่เสถียร จึงส่งให้ Admin ตรวจโพสต์และวันที่กิจกรรม",
  async fetch() {
    return { mode: this.mode, items: [], limitationNote: this.limitationNote };
  },
};
