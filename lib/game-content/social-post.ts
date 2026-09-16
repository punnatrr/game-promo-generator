const SOCIAL_PLATFORMS = {
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "fb.watch": "facebook",
  "instagram.com": "instagram",
  "tiktok.com": "tiktok",
  "x.com": "x",
  "twitter.com": "x",
} as const;

export type OfficialSocialPlatform =
  (typeof SOCIAL_PLATFORMS)[keyof typeof SOCIAL_PLATFORMS];

function normalizedHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^(?:www\.|m\.|web\.)/, "");
}

export function getOfficialSocialPlatform(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return SOCIAL_PLATFORMS[
      normalizedHostname(url.hostname) as keyof typeof SOCIAL_PLATFORMS
    ] || null;
  } catch {
    return null;
  }
}

export function normalizeOfficialSocialPostUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !getOfficialSocialPlatform(url.toString())) {
    throw new Error("รองรับเฉพาะลิงก์ Facebook, Instagram, TikTok หรือ X แบบ HTTPS");
  }
  const trackingKeys = ["fbclid", "__cft__", "__tn__", "mibextid", "igsh"];
  for (const key of [...url.searchParams.keys()]) {
    if (trackingKeys.includes(key) || key.toLowerCase().startsWith("utm_")) {
      url.searchParams.delete(key);
    }
  }
  url.hash = "";
  return url.toString();
}

export function deriveSocialPostTitle(postText: string) {
  const lines = postText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const title = lines.find((line) => line.length >= 4) || lines[0] || "";
  if (!title) throw new Error("กรุณาวางข้อความจากโพสต์ Official");
  return title.slice(0, 300);
}

export function buildIndexedSocialQuery(
  sourceName: string,
  sourceUrl: string,
  gameName: string,
  lookbackDays: number
) {
  const url = new URL(sourceUrl);
  const pageName = sourceName.replace(
    /\s+Official\s+(?:Facebook|Instagram|TikTok|X)$/i,
    ""
  );
  const queryName = pageName || gameName;
  const accountPath = decodeURIComponent(
    url.pathname.split("/").filter(Boolean)[0] || ""
  ).replace(/^@/, "");
  const accountName =
    accountPath &&
    !/^profile\.php$/i.test(accountPath) &&
    !/^\d+$/.test(accountPath)
      ? accountPath
      : null;
  const identityQuery =
    accountName &&
    accountName.toLocaleLowerCase("en") !==
      queryName.replace(/\s+/g, "").toLocaleLowerCase("en")
      ? `("${queryName}" OR "${accountName}")`
      : `"${queryName}"`;
  return `${identityQuery} site:${url.hostname} when:${lookbackDays}d`;
}
