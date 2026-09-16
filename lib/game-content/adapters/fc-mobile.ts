import type { GameContentSource } from "../types";
import {
  decodeHtml,
  fetchOfficialText,
  inferAdapterActivityType,
} from "./helpers";
import type { GameSourceAdapter, SourceAdapterItem } from "./types";

type FcMobileNewsItem = {
  title?: string;
  summary?: string;
  publishingDate?: string;
  slug?: string;
  image?: { ar16X9?: string; ar2X1?: string };
};

export function parseFcMobileOfficialNews(html: string): SourceAdapterItem[] {
  const jsonText = html.match(
    /<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
  )?.[1];
  if (!jsonText) return [];
  let items: FcMobileNewsItem[];
  try {
    const payload = JSON.parse(jsonText) as {
      props?: {
        pageProps?: {
          newsDataFallback?: { items?: FcMobileNewsItem[] };
        };
      };
    };
    items = payload.props?.pageProps?.newsDataFallback?.items || [];
  } catch {
    return [];
  }

  return items.flatMap((item) => {
    const publishedAt = new Date(item.publishingDate || "");
    if (
      !item.title?.trim() ||
      !item.slug?.match(/^[a-z0-9-]+$/) ||
      Number.isNaN(publishedAt.getTime())
    ) {
      return [];
    }
    const title = decodeHtml(item.title);
    return [{
      externalId: `fc-mobile-${item.slug}`,
      title,
      description:
        decodeHtml(item.summary || "") ||
        "ประกาศอย่างเป็นทางการจาก EA SPORTS FC Mobile",
      url:
        `https://www.ea.com/en/games/ea-sports-fc/fc-mobile/news/${item.slug}`,
      publishedAt: publishedAt.toISOString(),
      activityType: inferAdapterActivityType(title, item.summary),
      platform: "mobile",
      thumbnailUrl: item.image?.ar16X9 || item.image?.ar2X1 || null,
      tags: ["fc-mobile", "ea-official"],
    }];
  });
}

export const fcMobileOfficialAdapter: GameSourceAdapter = {
  key: "fc-mobile-official-news",
  gameSlug: "fc-mobile",
  mode: "ADAPTER",
  limitationNote:
    "อ่านเฉพาะ newsDataFallback ที่ EA ฝังในหน้า FC Mobile Official และไม่เรียก internal API เพิ่มเติม",
  async fetch(source: GameContentSource) {
    const html = await fetchOfficialText(source.url, {
      allowedHost: "www.ea.com",
      allowedPathPrefix: "/en/games/ea-sports-fc/fc-mobile/news",
      accept: "text/html",
    });
    return {
      mode: this.mode,
      items: parseFcMobileOfficialNews(html),
      limitationNote: this.limitationNote,
    };
  },
};
