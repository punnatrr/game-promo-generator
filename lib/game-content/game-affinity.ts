export type GameContentAffinity = "MATCH" | "CONFLICT" | "UNKNOWN";

type GameSignal = {
  slug: string;
  patterns: RegExp[];
};

const GAME_SIGNALS: GameSignal[] = [
  {
    slug: "efootball",
    patterns: [/\be[\s-]?football\b/i, /#efootball\b/i],
  },
  {
    slug: "cookierun-classic",
    patterns: [
      /\bcookie\s*run(?:\s*classic)?\b/i,
      /\bcrclassic(?:en)?\b/i,
      /คุกกี้\s*รัน/u,
    ],
  },
  { slug: "roblox", patterns: [/\broblox\b/i, /#roblox\b/i] },
  {
    slug: "free-fire",
    patterns: [/\bfree\s*fire(?:\s*max)?\b/i, /\bfreefire(?:max)?\b/i, /ฟีฟาย/u],
  },
  {
    slug: "free-fire-max",
    patterns: [/\bfree\s*fire\s*max\b/i, /\bfreefiremax\b/i],
  },
  {
    slug: "ragnarok-the-new-world",
    patterns: [
      /\bragnarok\s*:\s*the\s*new\s*world\b/i,
      /\bragnarok\s+the\s+new\s+world\b/i,
      /#ragnarokthenewworld\b/i,
    ],
  },
  {
    slug: "fc-mobile",
    patterns: [
      /\b(?:ea\s*sports\s*)?fc\s*mobile\b/i,
      /\beasfcmobile\b/i,
      /#fcmobile\b/i,
    ],
  },
  {
    slug: "garena-rov",
    patterns: [
      /(?:^|[^a-z0-9])#?rov(?:th|thai|thailand|s)?(?:$|[^a-z0-9])/i,
      /\bgarena\s*rov\b/i,
      /เมื่อฉันเล่นrov/iu,
      /สกินrov/iu,
    ],
  },
  {
    slug: "pubg-mobile",
    patterns: [/\bpubg\s*mobile\b/i, /\bpubgmobile\b/i, /#pubgm\b/i],
  },
  {
    slug: "mobile-legends",
    patterns: [
      /\bmobile\s*legends(?::\s*bang\s*bang)?\b/i,
      /\bmlbb\b/i,
      /โมบาย\s*เลเจนด์/iu,
    ],
  },
  {
    slug: "whiteout-survival",
    patterns: [/\bwhiteout\s*survival\b/i, /#whiteoutsurvival\b/i, /#wos\b/i],
  },
  { slug: "kingshot", patterns: [/\bkingshot\b/i, /#kingshot\b/i] },
  {
    slug: "last-war",
    patterns: [/\blast\s*war(?::\s*survival\s*game)?\b/i, /\blastwarsurvival\b/i],
  },
  {
    slug: "digimon-up",
    patterns: [/\bdigimon\s*up\b/i, /\bdigimon_up\b/i, /#digimonup\b/i],
  },
  {
    slug: "soul-land-awakening-world",
    patterns: [
      /\bsoul\s*land\s*:\s*awakening\s*world\b/i,
      /\bsoul\s*land\s+awakening\s+world\b/i,
      /#soullandawakeningworld\b/i,
    ],
  },
  {
    slug: "honkai-star-rail",
    patterns: [
      /\bhonkai\s*:\s*star\s*rail\b/i,
      /\bhonkai\s+star\s+rail\b/i,
      /#honkaistarrail\b/i,
      /#hsr\b/i,
    ],
  },
  {
    slug: "love-and-deepspace",
    patterns: [
      /\blove\s*and\s*deepspace\b/i,
      /\bloveanddeepspace\b/i,
      /#ladsgame\b/i,
    ],
  },
  {
    slug: "genshin-impact",
    patterns: [/\bgenshin\s*impact\b/i, /\bgenshinimpact\b/i, /#genshin\b/i],
  },
  {
    slug: "wuthering-waves",
    patterns: [
      /\bwuthering\s*waves\b/i,
      /\bwutheringwaves\b/i,
      /#wuwa\b/i,
    ],
  },
  { slug: "valorant", patterns: [/\bvalorant\b/i, /#valorantth\b/i] },
];

const COMPATIBLE_GAME_GROUPS = [
  new Set(["free-fire", "free-fire-max"]),
];

function compatibleSlugs(expectedGameSlug: string) {
  return (
    COMPATIBLE_GAME_GROUPS.find((group) => group.has(expectedGameSlug)) ||
    new Set([expectedGameSlug])
  );
}

export function assessGameContentAffinity(
  expectedGameSlug: string,
  title: string,
  description = ""
) {
  const content = `${title} ${description}`.normalize("NFKC");
  const matchedGameSlugs = GAME_SIGNALS.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(content))
  ).map(({ slug }) => slug);
  const expectedSlugs = compatibleSlugs(expectedGameSlug);
  const expectedMatch = matchedGameSlugs.some((slug) => expectedSlugs.has(slug));
  const conflictingGameSlugs = matchedGameSlugs.filter(
    (slug) => !expectedSlugs.has(slug)
  );

  let affinity: GameContentAffinity = "UNKNOWN";
  if (expectedMatch) affinity = "MATCH";
  else if (conflictingGameSlugs.length > 0) affinity = "CONFLICT";

  return {
    affinity,
    matchedGameSlugs,
    conflictingGameSlugs,
  };
}
