import type { GameContentSource } from "../types";
import {
  decodeHtml,
  fetchOfficialText,
  inferAdapterActivityType,
  toBangkokIsoFromDmy,
} from "./helpers";
import type { GameSourceAdapter, SourceAdapterItem } from "./types";

export function parseFreeFireOfficialNews(html: string): SourceAdapterItem[] {
  const blocks = Array.from(
    html.matchAll(
      /<li\s+id="(\d+)"\s+class="news-item[^"]*"[\s\S]*?<\/li>/gi
    )
  );
  return blocks.flatMap((match) => {
    const block = match[0];
    const href = block.match(/<a\s+href="([^"]+)"\s+class="news-link"/i)?.[1];
    const title = block.match(
      /<h4\s+class="news-title"[^>]*>([\s\S]*?)<\/h4>/i
    )?.[1];
    const date = block.match(
      /<span\s+class="news-time"[^>]*>([^<]+)<\/span>/i
    )?.[1];
    const category = block.match(
      /<span\s+class="news-category"[^>]*>([^<]+)<\/span>/i
    )?.[1];
    const image = block.match(/\sdata-src="(https:[^"]+)"/i)?.[1] || null;
    if (!href || !title || !date) return [];
    const cleanTitle = decodeHtml(title);
    const cleanCategory = decodeHtml(category || "ประกาศ");
    return [
      {
        externalId: `free-fire-${match[1]}`,
        title: cleanTitle,
        description: `ประกาศทางการประเภท ${cleanCategory}`,
        url: new URL(href, "https://ff.garena.com").toString(),
        publishedAt: toBangkokIsoFromDmy(date.trim()),
        activityType: inferAdapterActivityType(cleanTitle, cleanCategory),
        platform: "website",
        thumbnailUrl: image,
        tags: ["free-fire", cleanCategory],
      },
    ];
  });
}

export const freeFireOfficialAdapter: GameSourceAdapter = {
  key: "free-fire-official-news",
  gameSlug: "free-fire",
  mode: "ADAPTER",
  limitationNote:
    "ดึงเฉพาะรายการที่ server-rendered บนหน้า News ภาษาไทย ไม่ดึง Facebook หรือข้อมูลหลัง Login",
  async fetch(source: GameContentSource) {
    const html = await fetchOfficialText(source.url, {
      allowedHost: "ff.garena.com",
      allowedPathPrefix: "/th/news",
      accept: "text/html",
    });
    return {
      mode: this.mode,
      items: parseFreeFireOfficialNews(html),
      limitationNote: this.limitationNote,
    };
  },
};
