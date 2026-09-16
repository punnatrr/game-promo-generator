export type DiscoveredUpdateType =
  | "patch"
  | "skin"
  | "item"
  | "map"
  | "character"
  | "mode"
  | "collaboration";

export type DiscoveredRssItem = {
  title: string;
  url: string;
  publishedAt: string;
  description: string;
  platform: "website";
  updateType: DiscoveredUpdateType | null;
};

const UPDATE_KEYWORDS: Array<{
  type: DiscoveredUpdateType;
  keywords: string[];
}> = [
  {
    type: "collaboration",
    keywords: ["คอลแลบ", "ร่วมมือกับ", "collab", "collaboration", "crossover"],
  },
  {
    type: "skin",
    keywords: ["สกินใหม่", "ชุดใหม่", "คอสตูมใหม่", "new skin", "new outfit", "new costume"],
  },
  {
    type: "map",
    keywords: ["แผนที่ใหม่", "แมพใหม่", "new map", "map update", "battlefield"],
  },
  {
    type: "character",
    keywords: [
      "ตัวละครใหม่",
      "ฮีโร่ใหม่",
      "เอเจนท์ใหม่",
      "new character",
      "new hero",
      "new agent",
      "debut",
    ],
  },
  {
    type: "mode",
    keywords: [
      "โหมดใหม่",
      "ระบบใหม่",
      "ซีซันใหม่",
      "new mode",
      "new feature",
      "new season",
      "gameplay update",
    ],
  },
  {
    type: "item",
    keywords: [
      "ไอเทมใหม่",
      "อาวุธใหม่",
      "การ์ดใหม่",
      "แบนเนอร์ใหม่",
      "new item",
      "new weapon",
      "new card",
      "new banner",
      "shop update",
    ],
  },
  {
    type: "patch",
    keywords: [
      "แพตช์",
      "แพทช์",
      "อัปเดตเวอร์ชัน",
      "ปรับสมดุล",
      "patch",
      "version update",
      "hotfix",
      "balance adjustment",
      "bug fix",
    ],
  },
];

const EXCLUDED_KEYWORDS = [
  "การแข่งขัน",
  "ทัวร์นาเมนต์",
  "โปรลีก",
  "อีสปอร์ต",
  "ประกาศผู้โชคดี",
  "tournament",
  "championship",
  "grand final",
  "pro league",
  "esports",
  "giveaway winner",
];

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .trim();
}

function stripHtml(value: string) {
  return decodeXml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readTag(block: string, tag: string) {
  const match = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i")
  );
  return match ? decodeXml(match[1]) : "";
}

function readSourceName(block: string) {
  const match = block.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);
  return match ? stripHtml(match[1]) : "";
}

function classifyUpdate(title: string, description: string) {
  const content = `${title} ${description}`.toLocaleLowerCase("th");
  if (EXCLUDED_KEYWORDS.some((keyword) => content.includes(keyword))) {
    return null;
  }
  return (
    UPDATE_KEYWORDS.find(({ keywords }) =>
      keywords.some((keyword) => content.includes(keyword))
    )?.type ?? null
  );
}

export function parseGoogleNewsRss(xml: string): DiscoveredRssItem[] {
  return Array.from(
    xml.matchAll(/<item>([\s\S]*?)<\/item>/gi),
    (match) => match[1]
  )
    .map((block): DiscoveredRssItem | null => {
      const url = stripHtml(readTag(block, "link"));
      const source = readSourceName(block);
      const rawTitle = stripHtml(readTag(block, "title"));
      const suffix = source ? ` - ${source}` : "";
      const title =
        suffix && rawTitle.endsWith(suffix)
          ? rawTitle.slice(0, -suffix.length).trim()
          : rawTitle;
      const description = stripHtml(readTag(block, "description"));
      const publishedAt = new Date(readTag(block, "pubDate"));

      if (!title || !url || Number.isNaN(publishedAt.getTime())) return null;

      return {
        title,
        url,
        publishedAt: publishedAt.toISOString(),
        description,
        platform: "website",
        updateType: classifyUpdate(title, description),
      };
    })
    .filter((item): item is DiscoveredRssItem => item !== null);
}
