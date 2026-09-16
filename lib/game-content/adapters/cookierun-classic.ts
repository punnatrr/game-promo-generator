import { buildManualReviewItem } from "./helpers";
import type {
  GameSourceAdapter,
  ManualReviewInput,
  SourceAdapterItem,
} from "./types";

export function parseCookieRunClassicManualReview(
  input: ManualReviewInput
): SourceAdapterItem {
  const source = new URL(input.sourceUrl);
  if (
    source.protocol !== "https:" ||
    source.hostname !== "www.facebook.com" ||
    !source.pathname.toLowerCase().startsWith("/crclassicen")
  ) {
    throw new Error(
      "CookieRun Classic manual source is not on the official allowlist"
    );
  }
  return buildManualReviewItem({
    gameSlug: "cookierun-classic",
    externalIdPrefix: "cookierun-classic-manual",
    input,
    source,
    platform: "facebook",
  });
}

export const cookieRunClassicManualAdapter: GameSourceAdapter = {
  key: "cookierun-classic-manual",
  gameSlug: "cookierun-classic",
  mode: "MANUAL_REVIEW",
  limitationNote:
    "ยอมรับเฉพาะเพจ Facebook Official CRClassicEN ที่ผู้ดูแลยืนยัน; Facebook ไม่มี public feed ที่เสถียรและต้องไม่ข้ามระบบ Login",
  async fetch() {
    return { mode: this.mode, items: [], limitationNote: this.limitationNote };
  },
};
