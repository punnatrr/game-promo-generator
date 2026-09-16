import { buildManualReviewItem } from "./helpers";
import type {
  GameSourceAdapter,
  ManualReviewInput,
  SourceAdapterItem,
} from "./types";

export function parseLastWarManualReview(
  input: ManualReviewInput
): SourceAdapterItem {
  const source = new URL(input.sourceUrl);
  if (
    source.protocol !== "https:" ||
    !["lastwar.com", "www.lastwar.com"].includes(source.hostname)
  ) {
    throw new Error("Last War manual source is not on the official allowlist");
  }
  return buildManualReviewItem({
    gameSlug: "last-war",
    externalIdPrefix: "last-war-manual",
    input,
    source,
  });
}

export const lastWarManualAdapter: GameSourceAdapter = {
  key: "last-war-manual",
  gameSlug: "last-war",
  mode: "MANUAL_REVIEW",
  limitationNote:
    "เว็บไซต์ Official ไม่มีรายการข่าว server-rendered หรือ public feed ที่มีวันที่และลิงก์ข่าวครบถ้วน จึงต้องตรวจประกาศในเกม/Official ด้วยตนเอง",
  async fetch() {
    return { mode: this.mode, items: [], limitationNote: this.limitationNote };
  },
};
