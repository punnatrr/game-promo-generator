import type { GameContentSource } from "../types";
import {
  decodeHtml,
  fetchOfficialText,
  inferAdapterActivityType,
} from "./helpers";
import type { GameSourceAdapter, SourceAdapterItem } from "./types";

type RobloxTopic = {
  id?: number;
  title?: string;
  slug?: string;
  excerpt?: string;
  created_at?: string;
  views?: number;
  like_count?: number;
  pinned?: boolean;
};

export function parseRobloxAnnouncementsJson(
  json: string
): SourceAdapterItem[] {
  const payload = JSON.parse(json) as {
    topic_list?: { topics?: RobloxTopic[] };
  };
  const topics = payload.topic_list?.topics;
  if (!Array.isArray(topics)) {
    throw new Error("Roblox response does not contain topic_list.topics");
  }
  return topics.flatMap((topic) => {
    if (
      !topic.id ||
      !topic.title ||
      !topic.slug ||
      !topic.created_at ||
      (topic.pinned && /^about the /i.test(topic.title))
    ) {
      return [];
    }
    const title = decodeHtml(topic.title);
    const popularity = Math.min(
      100,
      Math.round(
        Math.log10(Math.max(1, topic.views || 0)) * 18 +
          Math.log10(Math.max(1, topic.like_count || 0)) * 8
      )
    );
    return [
      {
        externalId: `roblox-topic-${topic.id}`,
        title,
        description:
          decodeHtml(topic.excerpt || "") ||
          "ประกาศจาก Roblox Developer Forum",
        url: `https://devforum.roblox.com/t/${topic.slug}/${topic.id}`,
        publishedAt: new Date(topic.created_at).toISOString(),
        activityType: inferAdapterActivityType(title),
        platform: "website",
        thumbnailUrl: null,
        popularityScore: popularity,
        tags: ["roblox", "staff-announcement"],
      },
    ];
  });
}

export const robloxAnnouncementsAdapter: GameSourceAdapter = {
  key: "roblox-devforum-announcements",
  gameSlug: "roblox",
  mode: "ADAPTER",
  limitationNote:
    "ใช้ Discourse JSON ของหมวด Announcements ซึ่งกำหนดให้เฉพาะ Roblox staff สร้างหัวข้อได้ ไม่อ่านหมวดผู้ใช้ทั่วไป",
  async fetch(source: GameContentSource) {
    const json = await fetchOfficialText(source.url, {
      allowedHost: "devforum.roblox.com",
      allowedPathPrefix: "/c/updates/announcements/36",
      accept: "application/json",
    });
    return {
      mode: this.mode,
      items: parseRobloxAnnouncementsJson(json),
      limitationNote: this.limitationNote,
    };
  },
};
