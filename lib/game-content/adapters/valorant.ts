import type { GameContentSource } from "../types";
import {
  decodeHtml,
  fetchOfficialText,
  inferAdapterActivityType,
} from "./helpers";
import type { GameSourceAdapter, SourceAdapterItem } from "./types";

type ValorantNewsItem = {
  title?: string;
  publishedAt?: string;
  action?: { payload?: { url?: string } };
  category?: { machineName?: string; title?: string };
  description?: { body?: string };
  imageMedia?: { url?: string };
  media?: { url?: string };
  tags?: Array<{ title?: string }>;
  analytics?: { contentId?: string };
};

export function parseValorantThailandNews(
  html: string
): SourceAdapterItem[] {
  const jsonText = html.match(
    /<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
  )?.[1];
  if (!jsonText) return [];
  let items: ValorantNewsItem[];
  try {
    const payload = JSON.parse(jsonText) as {
      props?: {
        pageProps?: {
          page?: { blades?: Array<{ items?: ValorantNewsItem[] }> };
        };
      };
    };
    items =
      payload.props?.pageProps?.page?.blades?.find((blade) =>
        Array.isArray(blade.items)
      )?.items || [];
  } catch {
    return [];
  }

  return items.flatMap((item, index) => {
    const category = item.category?.machineName;
    const path = item.action?.payload?.url;
    const publishedAt = new Date(item.publishedAt || "");
    if (
      !item.title?.trim() ||
      !path?.startsWith("/th-th/news/") ||
      !["game_updates", "announcements"].includes(category || "") ||
      Number.isNaN(publishedAt.getTime())
    ) {
      return [];
    }
    const title = decodeHtml(item.title);
    const categoryTitle = decodeHtml(item.category?.title || "");
    return [{
      externalId:
        `valorant-${item.analytics?.contentId || path.split("/").filter(Boolean).pop() || index}`,
      title,
      description:
        decodeHtml(item.description?.body || "") ||
        "ประกาศอย่างเป็นทางการจาก VALORANT ประเทศไทย",
      url: new URL(path, "https://playvalorant.com").toString(),
      publishedAt: publishedAt.toISOString(),
      activityType: inferAdapterActivityType(
        title,
        `${categoryTitle} ${(item.tags || []).map((tag) => tag.title).join(" ")}`
      ),
      platform: "all",
      thumbnailUrl: item.imageMedia?.url || item.media?.url || null,
      tags: [
        "valorant",
        category || "official",
        ...(item.tags || []).map((tag) => tag.title || "").filter(Boolean),
      ],
    }];
  });
}

export const valorantThailandAdapter: GameSourceAdapter = {
  key: "valorant-thailand-news",
  gameSlug: "valorant",
  mode: "ADAPTER",
  limitationNote:
    "อ่านเฉพาะหมวด Game Updates และ Announcements ภาษาไทยที่ Riot ฝังในหน้า Official; ไม่รวมข่าว Esports",
  async fetch(source: GameContentSource) {
    const html = await fetchOfficialText(source.url, {
      allowedHost: "playvalorant.com",
      allowedPathPrefix: "/th-th/news/",
      accept: "text/html",
    });
    return {
      mode: this.mode,
      items: parseValorantThailandNews(html),
      limitationNote: this.limitationNote,
    };
  },
};
