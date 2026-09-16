import type { GameContentSource } from "../types";
import {
  decodeHtml,
  fetchOfficialText,
  inferAdapterActivityType,
  toBangkokIsoFromEnglishDate,
} from "./helpers";
import type { GameSourceAdapter, SourceAdapterItem } from "./types";

type RovPatchNote = {
  title?: string;
  description?: string;
  content_image?: string;
  show_datetime_text?: string;
  url?: string;
  tags?: Array<{ title?: string }> | null;
};

export function parseGarenaRovPatchNotes(html: string): SourceAdapterItem[] {
  const jsonText = html.match(
    /<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
  )?.[1];
  if (!jsonText) return [];
  let rows: RovPatchNote[];
  try {
    const payload = JSON.parse(jsonText) as {
      props?: {
        initialProps?: {
          pageProps?: { news?: RovPatchNote[] };
        };
      };
    };
    rows = payload.props?.initialProps?.pageProps?.news || [];
  } catch {
    return [];
  }

  return rows.flatMap((row) => {
    if (
      !row.title?.trim() ||
      !row.url?.startsWith("/patch-notes/") ||
      !row.show_datetime_text
    ) {
      return [];
    }
    let publishedAt: string;
    try {
      publishedAt = toBangkokIsoFromEnglishDate(row.show_datetime_text);
    } catch {
      return [];
    }
    const title = decodeHtml(row.title);
    const tags = (row.tags || [])
      .map((tag) => decodeHtml(tag.title || ""))
      .filter(Boolean);
    return [{
      externalId: `rov-${row.url.slice("/patch-notes/".length)}`,
      title,
      description:
        decodeHtml(row.description || "") ||
        "รายละเอียดแพตช์จากเว็บไซต์ Garena RoV ประเทศไทย",
      url: new URL(row.url, "https://rov.in.th").toString(),
      publishedAt,
      activityType: inferAdapterActivityType(title, tags.join(" ")),
      platform: "mobile",
      thumbnailUrl: row.content_image || null,
      tags: ["garena-rov", "patch-note", ...tags],
    }];
  });
}

export const garenaRovOfficialAdapter: GameSourceAdapter = {
  key: "garena-rov-patch-notes",
  gameSlug: "garena-rov",
  mode: "ADAPTER",
  limitationNote:
    "อ่านเฉพาะรายการ Patch Note ที่ Garena RoV ฝังในหน้า Official; Facebook และ Instagram ไม่ถูกดึงอัตโนมัติ",
  async fetch(source: GameContentSource) {
    const html = await fetchOfficialText(source.url, {
      allowedHost: "rov.in.th",
      allowedPathPrefix: "/patch-notes",
      accept: "text/html",
    });
    return {
      mode: this.mode,
      items: parseGarenaRovPatchNotes(html),
      limitationNote: this.limitationNote,
    };
  },
};
