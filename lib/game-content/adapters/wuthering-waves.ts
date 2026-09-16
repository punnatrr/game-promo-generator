import { buildManualReviewItem } from "./helpers";
import type {
  GameSourceAdapter,
  ManualReviewInput,
  SourceAdapterItem,
} from "./types";

export function parseWutheringWavesManualReview(
  input: ManualReviewInput
): SourceAdapterItem {
  const source = new URL(input.sourceUrl);
  if (
    source.protocol !== "https:" ||
    source.hostname !== "wutheringwaves.kurogames.com" ||
    !source.pathname.startsWith("/en/")
  ) {
    throw new Error(
      "Wuthering Waves manual source is not on the official allowlist"
    );
  }
  return buildManualReviewItem({
    gameSlug: "wuthering-waves",
    externalIdPrefix: "wuthering-waves-manual",
    input,
    source,
  });
}

export const wutheringWavesManualAdapter: GameSourceAdapter = {
  key: "wuthering-waves-manual",
  gameSlug: "wuthering-waves",
  mode: "MANUAL_REVIEW",
  limitationNote:
    "หน้า Kuro Games เป็น dynamic shell และไม่มี public feed contract ที่เสถียร จึงไม่เรียก internal API และให้ Admin ตรวจบทความ Official",
  async fetch() {
    return { mode: this.mode, items: [], limitationNote: this.limitationNote };
  },
};
