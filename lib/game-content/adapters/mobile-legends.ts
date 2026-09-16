import type {
  GameSourceAdapter,
  ManualReviewInput,
  SourceAdapterItem,
} from "./types";

function isAllowedOfficialUrl(source: URL) {
  if (
    source.hostname === "www.mobilelegends.com" ||
    source.hostname === "mobilelegends.com"
  ) {
    return true;
  }
  return (
    source.hostname === "www.facebook.com" &&
    ["/mobilelegendsgame", "/mobilelegendsgamethla"].some((path) =>
      source.pathname.toLowerCase().startsWith(path)
    )
  );
}

export function parseMobileLegendsManualReview(
  input: ManualReviewInput
): SourceAdapterItem {
  const source = new URL(input.sourceUrl);
  if (source.protocol !== "https:" || !isAllowedOfficialUrl(source)) {
    throw new Error("Mobile Legends manual source is not on the official allowlist");
  }
  const publishedAt = new Date(input.publishedAt);
  if (Number.isNaN(publishedAt.getTime()) || !input.title.trim()) {
    throw new Error("Mobile Legends manual review data is incomplete");
  }
  return {
    externalId: `mlbb-manual-${source.pathname}-${publishedAt.toISOString()}`,
    title: input.title.trim(),
    description:
      input.description?.trim() || "ข้อมูลยังไม่ครบถ้วน ต้องตรวจสอบด้วยตนเอง",
    url: source.toString(),
    publishedAt: publishedAt.toISOString(),
    activityType: "OTHER",
    platform: source.hostname === "www.facebook.com" ? "facebook" : "website",
    thumbnailUrl: null,
    tags: ["mobile-legends", "manual-review"],
  };
}

export const mobileLegendsManualAdapter: GameSourceAdapter = {
  key: "mobile-legends-manual",
  gameSlug: "mobile-legends",
  mode: "MANUAL_REVIEW",
  limitationNote:
    "หน้า Official โหลดรายการข่าวผ่าน internal dynamic API ที่ไม่มี public contract จึงต้องให้ Admin ตรวจและบันทึกลิงก์ Official ด้วยตนเอง",
  async fetch() {
    return {
      mode: this.mode,
      items: [],
      limitationNote: this.limitationNote,
    };
  },
};
