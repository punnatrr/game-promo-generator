import type { GameContentSource } from "../types";
import {
  decodeHtml,
  fetchOfficialText,
  inferAdapterActivityType,
} from "./helpers";
import type { GameSourceAdapter, SourceAdapterItem } from "./types";

export function parseDigimonUpOfficialNews(
  html: string
): SourceAdapterItem[] {
  const cards = Array.from(
    html.matchAll(
      /<a\s+href="\?p=(\d+)"\s+class="newsCard">([\s\S]*?)<\/a>/gi
    )
  );
  return cards.flatMap((match) => {
    const card = match[2];
    const date = card.match(
      /<time\s+datetime="(\d{4}-\d{2}-\d{2})"/i
    )?.[1];
    const category = card.match(
      /<ul\s+class="category">[\s\S]*?<li>([\s\S]*?)<\/li>/i
    )?.[1];
    const titleHtml = card.match(
      /<span\s+class="title">([\s\S]*?)<\/span>/i
    )?.[1];
    if (!date || !titleHtml) return [];
    const title = decodeHtml(titleHtml);
    const cleanCategory = decodeHtml(category || "News");
    return [{
      externalId: `digimon-up-${match[1]}`,
      title,
      description: `ประกาศ DIGIMON UP ประเภท ${cleanCategory}`,
      url: `https://dgup.bn-ent.net/en/news/?p=${match[1]}`,
      publishedAt: new Date(`${date}T12:00:00+07:00`).toISOString(),
      activityType: inferAdapterActivityType(title, cleanCategory),
      platform: "mobile",
      thumbnailUrl: null,
      tags: ["digimon-up", cleanCategory],
    }];
  });
}

export const digimonUpOfficialAdapter: GameSourceAdapter = {
  key: "digimon-up-official-news",
  gameSlug: "digimon-up",
  mode: "ADAPTER",
  limitationNote:
    "อ่านเฉพาะ newsCard จากหน้า News ภาษาอังกฤษของ Bandai Namco โดยตรง",
  async fetch(source: GameContentSource) {
    const html = await fetchOfficialText(source.url, {
      allowedHost: "dgup.bn-ent.net",
      allowedPathPrefix: "/en/news/",
      accept: "text/html",
    });
    return {
      mode: this.mode,
      items: parseDigimonUpOfficialNews(html),
      limitationNote: this.limitationNote,
    };
  },
};
