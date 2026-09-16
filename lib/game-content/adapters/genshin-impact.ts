import { buildManualReviewItem } from "./helpers";
import type {
  GameSourceAdapter,
  ManualReviewInput,
  SourceAdapterItem,
} from "./types";

export function parseGenshinImpactManualReview(
  input: ManualReviewInput
): SourceAdapterItem {
  const source = new URL(input.sourceUrl);
  if (
    source.protocol !== "https:" ||
    source.hostname !== "genshin.hoyoverse.com" ||
    !source.pathname.startsWith("/en/")
  ) {
    throw new Error(
      "Genshin Impact manual source is not on the official allowlist"
    );
  }
  return buildManualReviewItem({
    gameSlug: "genshin-impact",
    externalIdPrefix: "genshin-impact-manual",
    input,
    source,
  });
}

export const genshinImpactManualAdapter: GameSourceAdapter = {
  key: "genshin-impact-manual",
  gameSlug: "genshin-impact",
  mode: "MANUAL_REVIEW",
  limitationNote:
    "หน้า HoYoverse โหลดข่าวแบบ dynamic ผ่านบริการภายในที่ไม่มี public contract จึงเก็บเป็นผู้สมัครข่าวให้ Admin ตรวจจาก Official",
  async fetch() {
    return { mode: this.mode, items: [], limitationNote: this.limitationNote };
  },
};
