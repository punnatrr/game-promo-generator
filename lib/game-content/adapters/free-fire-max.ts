import type { GameContentSource } from "../types";
import {
  decodeHtml,
  fetchOfficialText,
  inferAdapterActivityType,
  toBangkokIsoFromDmy,
} from "./helpers";
import type { GameSourceAdapter, SourceAdapterItem } from "./types";

export function parseFreeFireMaxOfficialNews(
  html: string
): SourceAdapterItem[] {
  const blocks = Array.from(
    html.matchAll(
      /<li\s+id="(\d+)"\s+class="news-item[^"]*"[\s\S]*?<\/li>/gi
    )
  );
  return blocks.flatMap((match) => {
    const block = match[0];
    const href = block.match(/<a\s+href="([^"]+)"\s+class="news-link"/i)?.[1];
    const titleHtml = block.match(
      /<h4\s+class="news-title"[^>]*>([\s\S]*?)<\/h4>/i
    )?.[1];
    const date = block.match(
      /<span\s+class="news-time"[^>]*>([^<]+)<\/span>/i
    )?.[1];
    const categoryHtml = block.match(
      /<span\s+class="news-category"[^>]*>([^<]+)<\/span>/i
    )?.[1];
    if (!href || !titleHtml || !date) return [];
    const title = decodeHtml(titleHtml);
    const category = decodeHtml(categoryHtml || "ประกาศ");
    return [{
      externalId: `free-fire-max-${match[1]}`,
      title,
      description:
        `ประกาศร่วมของ Free Fire และ Free Fire MAX ประเภท ${category}`,
      url: new URL(href, "https://www.freefiremobile.com").toString(),
      publishedAt: toBangkokIsoFromDmy(date.trim()),
      activityType: inferAdapterActivityType(title, category),
      platform: "mobile",
      thumbnailUrl:
        block.match(/\sdata-src="(https:[^"]+)"/i)?.[1] || null,
      tags: ["free-fire-max", "shared-free-fire-update", category],
    }];
  });
}

export const freeFireMaxOfficialAdapter: GameSourceAdapter = {
  key: "free-fire-max-official-news",
  gameSlug: "free-fire-max",
  mode: "ADAPTER",
  limitationNote:
    "Free Fire MAX ใช้ข่าว Official ชุดเดียวกับ Free Fire; ระบบแยกรายการเป็นเกม MAX เพื่อให้ Admin พิจารณาความเกี่ยวข้องก่อน APPROVED",
  async fetch(source: GameContentSource) {
    const html = await fetchOfficialText(source.url, {
      allowedHost: "www.freefiremobile.com",
      allowedPathPrefix: "/th/news",
      accept: "text/html",
    });
    return {
      mode: this.mode,
      items: parseFreeFireMaxOfficialNews(html),
      limitationNote: this.limitationNote,
    };
  },
};
