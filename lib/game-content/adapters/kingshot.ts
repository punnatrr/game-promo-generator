import { buildManualReviewItem } from "./helpers";
import type {
  GameSourceAdapter,
  ManualReviewInput,
  SourceAdapterItem,
} from "./types";

export function parseKingshotManualReview(
  input: ManualReviewInput
): SourceAdapterItem {
  const source = new URL(input.sourceUrl);
  if (
    source.protocol !== "https:" ||
    source.hostname !== "www.facebook.com" ||
    !source.pathname.startsWith("/61560003321785")
  ) {
    throw new Error("Kingshot manual source is not on the official allowlist");
  }
  return buildManualReviewItem({
    gameSlug: "kingshot",
    externalIdPrefix: "kingshot-manual",
    input,
    source,
    platform: "facebook",
  });
}

export const kingshotManualAdapter: GameSourceAdapter = {
  key: "kingshot-manual",
  gameSlug: "kingshot",
  mode: "MANUAL_REVIEW",
  limitationNote:
    "เพจ Official ใช้ Facebook page ID และไม่มี public feed ที่เสถียร ระบบจึงไม่ดึง HTML หลัง Login",
  async fetch() {
    return { mode: this.mode, items: [], limitationNote: this.limitationNote };
  },
};
