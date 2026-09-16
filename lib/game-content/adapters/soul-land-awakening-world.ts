import { buildManualReviewItem } from "./helpers";
import type {
  GameSourceAdapter,
  ManualReviewInput,
  SourceAdapterItem,
} from "./types";

export function parseSoulLandAwakeningWorldManualReview(
  input: ManualReviewInput
): SourceAdapterItem {
  const source = new URL(input.sourceUrl);
  if (
    source.protocol !== "https:" ||
    source.hostname !== "gevents.37games.com" ||
    !source.pathname.startsWith("/official_slmsea/")
  ) {
    throw new Error(
      "Soul Land: Awakening World manual source is not on the official allowlist"
    );
  }
  return buildManualReviewItem({
    gameSlug: "soul-land-awakening-world",
    externalIdPrefix: "soul-land-awakening-world-manual",
    input,
    source,
  });
}

export const soulLandAwakeningWorldManualAdapter: GameSourceAdapter = {
  key: "soul-land-awakening-world-manual",
  gameSlug: "soul-land-awakening-world",
  mode: "MANUAL_REVIEW",
  limitationNote:
    "หน้า Official แสดงรายการผ่าน API ภายในที่ไม่มี public contract จึงไม่จำลอง endpoint และให้ Admin ตรวจรายการก่อนอนุมัติ",
  async fetch() {
    return { mode: this.mode, items: [], limitationNote: this.limitationNote };
  },
};
