import type { ActivityType } from "../types";
import type { ManualReviewInput, SourceAdapterItem } from "./types";

export function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function inferAdapterActivityType(
  title: string,
  category = ""
): ActivityType {
  const content = `${title} ${category}`.toLocaleLowerCase("th");
  if (
    /jujutsu kaisen|dandadan|ลิขสิทธิ์|ครอสโอเวอร์|\s[x×]\s/.test(
      content
    )
  ) {
    return "COLLABORATION";
  }
  if (/valor pass|starlight|\bpass\b|พาส|แสงดาว|รายเดือน/.test(content)) {
    return "BATTLE_PASS";
  }
  if (/collab|crossover|ความร่วมมือ|คอลแลบ/.test(content)) {
    return "COLLABORATION";
  }
  if (/patch|version|update|อัปเดต|แพตช์|แพทช์/.test(content)) {
    return "VERSION_UPDATE";
  }
  if (/skin|costume|outfit|สกิน|ชุดใหม่/.test(content)) return "NEW_SKIN";
  if (/character|hero|agent|ตัวละคร|ฮีโร่/.test(content)) {
    return "NEW_CHARACTER";
  }
  if (/map|แผนที่|แมพ/.test(content)) return "NEW_MAP";
  if (/mode|โหมด/.test(content)) return "NEW_MODE";
  if (/item|weapon|ไอเทม|อาวุธ/.test(content)) return "NEW_ITEM";
  if (/season|battle pass|royale pass|ซีซัน/.test(content)) {
    return "BATTLE_PASS";
  }
  return "OTHER";
}

export function toBangkokIsoFromDmy(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) throw new Error(`Invalid DD/MM/YYYY date: ${value}`);
  return new Date(
    `${match[3]}-${match[2]}-${match[1]}T12:00:00+07:00`
  ).toISOString();
}

export function toBangkokIsoFromEnglishDate(value: string) {
  const parsed = new Date(`${value} 12:00:00 GMT+0700`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid English date: ${value}`);
  }
  return parsed.toISOString();
}

export function buildManualReviewItem({
  gameSlug,
  externalIdPrefix,
  input,
  source,
  platform = "website",
}: {
  gameSlug: string;
  externalIdPrefix: string;
  input: ManualReviewInput;
  source: URL;
  platform?: string;
}): SourceAdapterItem {
  const publishedAt = new Date(input.publishedAt);
  if (Number.isNaN(publishedAt.getTime()) || !input.title.trim()) {
    throw new Error(`${gameSlug} manual review data is incomplete`);
  }
  const title = input.title.trim();
  return {
    externalId: `${externalIdPrefix}-${source.pathname}-${publishedAt.toISOString()}`,
    title,
    description:
      input.description?.trim() ||
      "ข้อมูลจากแหล่ง Official ที่ต้องให้ Admin ตรวจสอบก่อนอนุมัติ",
    url: source.toString(),
    publishedAt: publishedAt.toISOString(),
    activityType: inferAdapterActivityType(title, input.description),
    platform,
    thumbnailUrl: null,
    tags: [gameSlug, "manual-review"],
  };
}

export async function fetchOfficialText(
  url: string,
  {
    allowedHost,
    allowedPathPrefix,
    accept,
  }: {
    allowedHost: string;
    allowedPathPrefix: string;
    accept: string;
  }
) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== allowedHost ||
    !parsed.pathname.startsWith(allowedPathPrefix)
  ) {
    throw new Error("Adapter source URL is outside its official allowlist");
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(parsed, {
        headers: {
          Accept: accept,
          "User-Agent": "LAZY TOPUP Game Calendar/1.0",
        },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Official source returned ${response.status}`);
      }
      const length = Number(response.headers.get("content-length") || 0);
      if (length > 2_500_000) throw new Error("Official response is too large");
      const body = await response.text();
      if (body.length > 2_500_000) {
        throw new Error("Official response is too large");
      }
      return body;
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Official source request failed");
}
