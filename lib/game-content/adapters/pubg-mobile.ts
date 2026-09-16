import type {
  GameSourceAdapter,
  ManualReviewInput,
  SourceAdapterItem,
} from "./types";

function isAllowedOfficialUrl(source: URL) {
  if (
    source.hostname === "www.pubgmobile.com" ||
    source.hostname === "pubgmobile.com"
  ) {
    return true;
  }
  const accountPath = source.pathname.toLowerCase();
  if (source.hostname === "www.facebook.com") {
    return accountPath.startsWith("/pubgmobile");
  }
  return (
    (source.hostname === "x.com" || source.hostname === "twitter.com") &&
    accountPath.startsWith("/pubgmobile")
  );
}

export function parsePubgMobileManualReview(
  input: ManualReviewInput
): SourceAdapterItem {
  const source = new URL(input.sourceUrl);
  if (source.protocol !== "https:" || !isAllowedOfficialUrl(source)) {
    throw new Error("PUBG Mobile manual source is not on the official allowlist");
  }
  const publishedAt = new Date(input.publishedAt);
  if (Number.isNaN(publishedAt.getTime()) || !input.title.trim()) {
    throw new Error("PUBG Mobile manual review data is incomplete");
  }
  return {
    externalId: `pubgm-manual-${source.pathname}-${publishedAt.toISOString()}`,
    title: input.title.trim(),
    description:
      input.description?.trim() || "ข้อมูลยังไม่ครบถ้วน ต้องตรวจสอบด้วยตนเอง",
    url: source.toString(),
    publishedAt: publishedAt.toISOString(),
    activityType: "OTHER",
    platform: "website",
    thumbnailUrl: null,
    tags: ["pubg-mobile", "manual-review"],
  };
}

export const pubgMobileManualAdapter: GameSourceAdapter = {
  key: "pubg-mobile-manual",
  gameSlug: "pubg-mobile",
  mode: "MANUAL_REVIEW",
  limitationNote:
    "หน้า Official ใช้ internal API ที่ต้องสร้างลายเซ็นตาม JavaScript ภายในและไม่มี public feed จึงไม่เรียกเลียนแบบ ให้ Admin บันทึกลิงก์ Official ด้วยตนเอง",
  async fetch() {
    return {
      mode: this.mode,
      items: [],
      limitationNote: this.limitationNote,
    };
  },
};
