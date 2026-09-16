import { inferAdapterActivityType } from "./adapters/helpers";
import {
  createActivityWithResult,
  listSources,
} from "./repository";
import {
  deriveSocialPostTitle,
  getOfficialSocialPlatform,
  normalizeOfficialSocialPostUrl,
} from "./social-post";
import type { ActivityType } from "./types";

export async function importOfficialSocialPost(input: {
  gameId: string;
  sourceId: string;
  postUrl: string;
  postText: string;
  publishedAt: string;
  activityType?: ActivityType;
}) {
  const source = (await listSources(input.gameId)).find(
    (item) => item.id === input.sourceId
  );
  if (!source || source.sourceType !== "OFFICIAL_SOCIAL") {
    throw new Error("ไม่พบ Source Social Official ของเกมที่เลือก");
  }

  const postUrl = normalizeOfficialSocialPostUrl(input.postUrl);
  const postPlatform = getOfficialSocialPlatform(postUrl);
  const sourcePlatform = getOfficialSocialPlatform(source.url);
  if (!postPlatform || postPlatform !== sourcePlatform) {
    throw new Error("แพลตฟอร์มของลิงก์โพสต์ไม่ตรงกับ Source ที่เลือก");
  }

  const publishedAt = new Date(input.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) {
    throw new Error("วันที่เผยแพร่โพสต์ไม่ถูกต้อง");
  }
  const postText = input.postText.trim();
  const title = deriveSocialPostTitle(postText);
  const activityType =
    input.activityType || inferAdapterActivityType(title, postText);
  const monetizationScore = [
    "NEW_ITEM",
    "NEW_SKIN",
    "NEW_CHARACTER",
    "NEW_PACKAGE",
    "BATTLE_PASS",
    "TOPUP_EVENT",
    "GACHA",
  ].includes(activityType)
    ? 70
    : 40;

  return createActivityWithResult({
    gameId: input.gameId,
    title,
    originalTitle: title,
    activityType,
    description: postText,
    announcementDate: publishedAt.toISOString(),
    region: "TH",
    platform: postPlatform,
    sourceName: source.name,
    sourceUrl: postUrl,
    sourceType: "OFFICIAL_SOCIAL",
    sourcePublishedAt: publishedAt.toISOString(),
    verificationStatus: "OFFICIAL",
    confidenceScore: source.credibilityScore,
    popularityScore: 85,
    monetizationScore,
    urgencyScore: 90,
    tags: [
      "official-social",
      "admin-quick-import",
      postPlatform,
      activityType,
    ],
  });
}
