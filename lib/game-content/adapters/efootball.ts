import type { GameContentSource } from "../types";
import {
  fetchOfficialText,
  inferAdapterActivityType,
} from "./helpers";
import type { GameSourceAdapter, SourceAdapterItem } from "./types";

type EfootballNewsRow = {
  id: number;
  beginDate: string;
  title: string;
  category: number;
  ios?: string;
  android?: string;
};

export function parseEfootballOfficialNews(html: string): SourceAdapterItem[] {
  const payload = html.match(
    /\bnewsData:\s*(\[[\s\S]*?\]),\s*filteredNews:\s*\[\]/
  )?.[1];
  if (!payload) return [];

  let rows: EfootballNewsRow[];
  try {
    rows = JSON.parse(payload) as EfootballNewsRow[];
  } catch {
    return [];
  }

  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (
      !Number.isInteger(row.id) ||
      !row.title?.trim() ||
      !row.beginDate ||
      (row.ios !== "true" && row.android !== "true")
    ) {
      return [];
    }
    const duplicateKey = `${row.title}|${row.beginDate}`;
    if (seen.has(duplicateKey)) return [];
    seen.add(duplicateKey);
    const publishedAt = new Date(
      `${row.beginDate.replace(" ", "T")}Z`
    );
    if (Number.isNaN(publishedAt.getTime())) return [];
    const title = row.title.trim();
    return [{
      externalId: `efootball-${row.id}`,
      title,
      description: "ประกาศอย่างเป็นทางการจาก eFootball สำหรับผู้เล่นบนมือถือ",
      url: `https://www.konami.com/efootball/en-us/topic/news/${row.id}`,
      publishedAt: publishedAt.toISOString(),
      activityType: inferAdapterActivityType(title),
      platform: "mobile",
      thumbnailUrl: `https://www.konami.com/efootball/s/img/news/top_thumb_${row.category}.jpg`,
      tags: ["efootball", "official", "mobile"],
    }];
  });
}

export const efootballOfficialAdapter: GameSourceAdapter = {
  key: "efootball-official-news",
  gameSlug: "efootball",
  mode: "ADAPTER",
  limitationNote:
    "อ่าน newsData ที่หน้า Official ส่งมาโดยตรง และเลือกเฉพาะประกาศที่รองรับ iOS หรือ Android",
  async fetch(source: GameContentSource) {
    const html = await fetchOfficialText(source.url, {
      allowedHost: "www.konami.com",
      allowedPathPrefix: "/efootball/en-us/topic/news/list",
      accept: "text/html",
    });
    return {
      mode: this.mode,
      items: parseEfootballOfficialNews(html),
      limitationNote: this.limitationNote,
    };
  },
};
