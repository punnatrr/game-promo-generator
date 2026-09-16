type OfficialSocialPlatform = "Facebook" | "Instagram" | "TikTok" | "X";

type OfficialSocialSourceSeed = {
  gameSlug: string;
  name: string;
  url: string;
  sourceType: "OFFICIAL_SOCIAL";
  credibilityScore: 100;
  language: string;
  adapterKey: string | null;
  automationMode: "MANUAL_REVIEW";
  limitationNote: string;
};

const SOCIAL_SOURCE_LIMITATION =
  "Official account verified from the developer website or official app-store listing. Indexed posts from the previous 7 days are collected automatically; fresh posts can be sent immediately through Quick Official Social Import and every result requires Admin review.";

const OFFICIAL_SOCIAL_ROWS = [
  ["efootball", "eFootball", "Facebook", "https://www.facebook.com/playeFootball", "en", null],
  ["efootball", "eFootball", "Instagram", "https://www.instagram.com/efootball/", "en", null],
  ["efootball", "eFootball", "X", "https://x.com/play_efootball", "en", null],

  ["cookierun-classic", "CookieRun Classic", "Facebook", "https://www.facebook.com/CRClassicEN", "en", "cookierun-classic-manual"],
  ["cookierun-classic", "CookieRun Classic", "Instagram", "https://www.instagram.com/crclassic_en/", "en", null],
  ["cookierun-classic", "CookieRun Classic", "X", "https://x.com/CRClassicEN", "en", null],

  ["roblox", "Roblox", "Facebook", "https://www.facebook.com/roblox/", "en", null],
  ["roblox", "Roblox", "Instagram", "https://www.instagram.com/roblox/", "en", null],
  ["roblox", "Roblox", "TikTok", "https://www.tiktok.com/@roblox", "en", null],
  ["roblox", "Roblox", "X", "https://x.com/Roblox", "en", null],

  ["free-fire", "Free Fire Thailand", "Facebook", "https://www.facebook.com/freefireth", "th", null],
  ["free-fire", "Free Fire Thailand", "Instagram", "https://www.instagram.com/freefireth/", "th", null],
  ["free-fire-max", "Free Fire MAX (shared Free Fire Thailand)", "Facebook", "https://www.facebook.com/freefireth", "th", null],
  ["free-fire-max", "Free Fire MAX (shared Free Fire Thailand)", "Instagram", "https://www.instagram.com/freefireth/", "th", null],

  ["ragnarok-the-new-world", "Ragnarok: The New World", "Facebook", "https://www.facebook.com/RagnarokTheNewWorld.Gravity", "en", "ragnarok-the-new-world-manual"],

  ["fc-mobile", "EA SPORTS FC Mobile", "Facebook", "https://www.facebook.com/EASFCMobile/", "en", null],
  ["fc-mobile", "EA SPORTS FC Mobile", "Instagram", "https://www.instagram.com/easfcmobile/", "en", null],
  ["fc-mobile", "EA SPORTS FC Mobile", "X", "https://x.com/EASFCMOBILE", "en", null],

  ["garena-rov", "Garena RoV Thailand", "Facebook", "https://www.facebook.com/ROVTH/", "th", null],
  ["garena-rov", "Garena RoV Thailand", "Instagram", "https://www.instagram.com/garena_rov_official/", "th", null],
  ["garena-rov", "Garena RoV Thailand", "X", "https://x.com/garenarovth", "th", null],

  ["pubg-mobile", "PUBG MOBILE", "Facebook", "https://www.facebook.com/PUBGMobile", "en", null],
  ["pubg-mobile", "PUBG MOBILE", "Instagram", "https://www.instagram.com/pubgmobile", "en", null],
  ["pubg-mobile", "PUBG MOBILE", "TikTok", "https://www.tiktok.com/@pubgmobile", "en", null],
  ["pubg-mobile", "PUBG MOBILE", "X", "https://x.com/PUBGMobile", "en", null],

  ["mobile-legends", "Mobile Legends: Bang Bang Thailand", "Facebook", "https://www.facebook.com/MobileLegendsGameTHLA/", "th", "mobile-legends-manual"],
  ["mobile-legends", "Mobile Legends: Bang Bang", "Instagram", "https://www.instagram.com/mobilelegendsgame/", "en", null],
  ["mobile-legends", "Mobile Legends: Bang Bang", "X", "https://x.com/MobileLegendsOL", "en", null],

  ["whiteout-survival", "Whiteout Survival", "Facebook", "https://www.facebook.com/WhiteoutSurvival", "en", null],
  ["whiteout-survival", "Whiteout Survival", "Instagram", "https://www.instagram.com/whiteoutsurvival", "en", null],
  ["whiteout-survival", "Whiteout Survival", "TikTok", "https://www.tiktok.com/@whiteoutsurvivalofficial", "en", null],
  ["whiteout-survival", "Whiteout Survival", "X", "https://x.com/WOS_Global", "en", null],

  ["kingshot", "Kingshot", "Facebook", "https://www.facebook.com/61560003321785", "en", "kingshot-manual"],

  ["last-war", "Last War: Survival Game", "Facebook", "https://www.facebook.com/lastwarsurvival", "en", null],
  ["last-war", "Last War: Survival Game", "Instagram", "https://www.instagram.com/lastwarsurvival_official", "en", null],
  ["last-war", "Last War: Survival Game", "X", "https://x.com/lastwarsurvival", "en", null],

  ["digimon-up", "DIGIMON UP", "Facebook", "https://www.facebook.com/digimon.up.en/", "en", null],
  ["digimon-up", "DIGIMON UP", "X", "https://x.com/Digimon_up_en", "en", null],

  ["soul-land-awakening-world", "Soul Land: Awakening World", "Facebook", "https://www.facebook.com/profile.php?id=61586910441563", "en", null],
  ["soul-land-awakening-world", "Soul Land: Awakening World", "TikTok", "https://www.tiktok.com/@aichagag2o6", "en", null],

  ["honkai-star-rail", "Honkai: Star Rail Thailand", "Facebook", "https://www.facebook.com/HonkaiStarRail.TH", "th", null],
  ["honkai-star-rail", "Honkai: Star Rail", "Instagram", "https://www.instagram.com/honkaistarrail/", "en", null],
  ["honkai-star-rail", "Honkai: Star Rail", "TikTok", "https://www.tiktok.com/@honkaistarrail_official", "en", null],
  ["honkai-star-rail", "Honkai: Star Rail", "X", "https://x.com/honkaistarrail", "en", null],

  ["love-and-deepspace", "Love and Deepspace", "Facebook", "https://www.facebook.com/LoveandDeepspaceEN", "en", null],
  ["love-and-deepspace", "Love and Deepspace", "X", "https://x.com/Love_Deepspace", "en", null],

  ["genshin-impact", "Genshin Impact", "Facebook", "https://www.facebook.com/Genshinimpact/", "en", null],
  ["genshin-impact", "Genshin Impact", "Instagram", "https://www.instagram.com/genshinimpact/", "en", null],
  ["genshin-impact", "Genshin Impact", "TikTok", "https://www.tiktok.com/@genshinimpact_en", "en", null],
  ["genshin-impact", "Genshin Impact", "X", "https://x.com/GenshinImpact", "en", null],

  ["wuthering-waves", "Wuthering Waves Thailand", "Facebook", "https://www.facebook.com/WutheringWavesTH.Official", "th", null],
  ["wuthering-waves", "Wuthering Waves", "Instagram", "https://www.instagram.com/wuthering_waves", "en", null],
  ["wuthering-waves", "Wuthering Waves", "TikTok", "https://www.tiktok.com/@wutheringwaves_official", "en", null],
  ["wuthering-waves", "Wuthering Waves Thailand", "X", "https://x.com/WW_TH_Official", "th", null],

  ["valorant", "VALORANT Thailand", "Facebook", "https://www.facebook.com/VALORANTth", "th", null],
  ["valorant", "VALORANT", "Instagram", "https://www.instagram.com/valorant/", "en", null],
  ["valorant", "VALORANT Thailand", "TikTok", "https://www.tiktok.com/@valorantth", "th", null],
  ["valorant", "VALORANT", "X", "https://x.com/VALORANT", "en", null],
] as const satisfies ReadonlyArray<
  readonly [
    gameSlug: string,
    gameName: string,
    platform: OfficialSocialPlatform,
    url: `https://${string}`,
    language: string,
    adapterKey: string | null,
  ]
>;

export const GAME_CONTENT_SOCIAL_SOURCE_SEEDS: readonly OfficialSocialSourceSeed[] =
  OFFICIAL_SOCIAL_ROWS.map(
    ([gameSlug, gameName, platform, url, language, adapterKey]) => ({
      gameSlug,
      name: `${gameName} Official ${platform}`,
      url,
      sourceType: "OFFICIAL_SOCIAL",
      credibilityScore: 100,
      language,
      adapterKey,
      automationMode: "MANUAL_REVIEW",
      limitationNote: SOCIAL_SOURCE_LIMITATION,
    })
  );
