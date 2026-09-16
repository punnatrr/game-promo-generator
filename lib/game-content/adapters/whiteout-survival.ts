import type { GameContentSource } from "../types";
import {
  decodeHtml,
  fetchOfficialText,
  inferAdapterActivityType,
  toBangkokIsoFromEnglishDate,
} from "./helpers";
import type { GameSourceAdapter, SourceAdapterItem } from "./types";

export function parseWhiteoutCenturyGamesNews(
  html: string
): SourceAdapterItem[] {
  const blocks = Array.from(
    html.matchAll(
      /<div\s+class="news-item"[^>]*>([\s\S]*?)<h6\s+class="news-item-title">([\s\S]*?)<\/h6>\s*<\/div>/gi
    )
  );
  return blocks.flatMap((match) => {
    const block = `${match[1]}${match[2]}`;
    const titleMatch = block.match(
      /<h6\s+class="news-item-title"><a\s+href="([^"]+)">([\s\S]*?)<\/a>/i
    ) || match[0].match(
      /<h6\s+class="news-item-title"><a\s+href="([^"]+)">([\s\S]*?)<\/a>/i
    );
    const date = block.match(
      /<div\s+class="news-item-date">\s*<span>([^<]+)<\/span>/i
    )?.[1];
    const image =
      block.match(/\sdata-lazy-src="(https:[^"]+)"/i)?.[1] || null;
    if (!titleMatch || !date) return [];
    const title = decodeHtml(titleMatch[2]);
    if (!/^Whiteout Survival\b/i.test(title)) return [];
    const url = new URL(titleMatch[1], "https://www.centurygames.com").toString();
    const slug = new URL(url).pathname.replace(/^\/|\/$/g, "");
    return [
      {
        externalId: `whiteout-${slug}`,
        title,
        description: "ประกาศจาก Century Games ผู้พัฒนา Whiteout Survival",
        url,
        publishedAt: toBangkokIsoFromEnglishDate(date.trim()),
        activityType: inferAdapterActivityType(title),
        platform: "website",
        thumbnailUrl: image,
        tags: ["whiteout-survival", "century-games"],
      },
    ];
  });
}

export const whiteoutCenturyGamesAdapter: GameSourceAdapter = {
  key: "whiteout-century-games-news",
  gameSlug: "whiteout-survival",
  mode: "ADAPTER",
  limitationNote:
    "ดึงเฉพาะข่าว Whiteout Survival ที่เผยแพร่บนเว็บไซต์ Century Games; ข่าวในเกมและโพสต์ Social ยังต้องตรวจด้วยตนเอง",
  async fetch(source: GameContentSource) {
    const html = await fetchOfficialText(source.url, {
      allowedHost: "www.centurygames.com",
      allowedPathPrefix: "/games/a/",
      accept: "text/html",
    });
    return {
      mode: this.mode,
      items: parseWhiteoutCenturyGamesNews(html),
      limitationNote: this.limitationNote,
    };
  },
};
