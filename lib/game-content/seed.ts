import { GAME_CONTENT_SOCIAL_SOURCE_SEEDS } from "./social-seeds";

export const GAME_CONTENT_GAME_SEEDS = [
  ["efootball", "eFootball"],
  ["cookierun-classic", "CookieRun Classic"],
  ["roblox", "Roblox"],
  ["free-fire", "Free Fire"],
  ["free-fire-max", "Free Fire MAX"],
  ["ragnarok-the-new-world", "Ragnarok: The New World"],
  ["fc-mobile", "EA SPORTS FC Mobile"],
  ["garena-rov", "Garena RoV"],
  ["pubg-mobile", "PUBG Mobile"],
  ["mobile-legends", "Mobile Legends: Bang Bang"],
  ["whiteout-survival", "Whiteout Survival"],
  ["kingshot", "Kingshot"],
  ["last-war", "Last War: Survival Game"],
  ["digimon-up", "DIGIMON UP"],
  ["soul-land-awakening-world", "Soul Land: Awakening World"],
  ["honkai-star-rail", "Honkai: Star Rail"],
  ["love-and-deepspace", "Love and Deepspace"],
  ["genshin-impact", "Genshin Impact"],
  ["wuthering-waves", "Wuthering Waves"],
  ["valorant", "Valorant"],
] as const;

const GAME_CONTENT_PRIMARY_SOURCE_SEEDS = [
  {
    gameSlug: "efootball",
    name: "eFootball Official",
    url: "https://www.konami.com/efootball/en-us/topic/news/list",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "en",
    adapterKey: "efootball-official-news",
    automationMode: "ADAPTER",
    limitationNote:
      "อ่านรายการข่าว Official ที่รองรับ iOS หรือ Android จาก newsData ของ Konami",
  },
  {
    gameSlug: "roblox",
    name: "Roblox Staff Announcements",
    url: "https://devforum.roblox.com/c/updates/announcements/36.json",
    sourceType: "OFFICIAL_COMMUNITY",
    credibilityScore: 98,
    language: "en",
    adapterKey: "roblox-devforum-announcements",
    automationMode: "ADAPTER",
    limitationNote:
      "อ่านเฉพาะหมวด Announcements ที่ Roblox กำหนดให้ Roblox staff สร้างหัวข้อได้",
  },
  {
    gameSlug: "free-fire",
    name: "Free Fire Official Thailand",
    url: "https://ff.garena.com/th/news/",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "th",
    adapterKey: "free-fire-official-news",
    automationMode: "ADAPTER",
    limitationNote:
      "ดึงจากรายการข่าวภาษาไทยที่แสดงใน HTML ของ Garena โดยตรง",
  },
  {
    gameSlug: "free-fire-max",
    name: "Free Fire MAX Official Thailand",
    url: "https://www.freefiremobile.com/th/news/",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "th",
    adapterKey: "free-fire-max-official-news",
    automationMode: "ADAPTER",
    limitationNote:
      "Free Fire MAX ใช้ประกาศ Official ชุดเดียวกับ Free Fire และรอ Admin ตรวจความเกี่ยวข้องก่อนอนุมัติ",
  },
  {
    gameSlug: "fc-mobile",
    name: "EA SPORTS FC Mobile Official",
    url: "https://www.ea.com/en/games/ea-sports-fc/fc-mobile/news",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "en",
    adapterKey: "fc-mobile-official-news",
    automationMode: "ADAPTER",
    limitationNote:
      "อ่านเฉพาะรายการ FC Mobile ที่ EA ฝังในหน้า Official โดยไม่เรียก internal API",
  },
  {
    gameSlug: "garena-rov",
    name: "Garena RoV Thailand Patch Notes",
    url: "https://rov.in.th/patch-notes",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "th",
    adapterKey: "garena-rov-patch-notes",
    automationMode: "ADAPTER",
    limitationNote:
      "อ่านเฉพาะ Patch Note จากเว็บไซต์ Garena RoV; Social ยังต้องตรวจด้วยตนเอง",
  },
  {
    gameSlug: "pubg-mobile",
    name: "PUBG MOBILE Official",
    url: "https://www.pubgmobile.com/en-US/news.shtml",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "en",
    adapterKey: "pubg-mobile-manual",
    automationMode: "MANUAL_REVIEW",
    limitationNote:
      "หน้า Official ใช้ internal signed API ที่ไม่มี public contract จึงไม่จำลองลายเซ็นหรือข้ามระบบป้องกัน",
  },
  {
    gameSlug: "mobile-legends",
    name: "Mobile Legends Official News",
    url: "https://www.mobilelegends.com/en/news",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "en",
    adapterKey: "mobile-legends-manual",
    automationMode: "MANUAL_REVIEW",
    limitationNote:
      "หน้า Official โหลดข่าวผ่าน internal dynamic API ที่ไม่มี public contract จึงไม่เรียกเลียนแบบ",
  },
  {
    gameSlug: "whiteout-survival",
    name: "Century Games Official News",
    url: "https://www.centurygames.com/games/a/",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "en",
    adapterKey: "whiteout-century-games-news",
    automationMode: "ADAPTER",
    limitationNote:
      "ดึงเฉพาะข่าวที่ชื่อขึ้นต้นด้วย Whiteout Survival บนเว็บไซต์ผู้พัฒนา Century Games",
  },
  {
    gameSlug: "last-war",
    name: "Last War Official",
    url: "https://www.lastwar.com/en/home.html",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "en",
    adapterKey: "last-war-manual",
    automationMode: "MANUAL_REVIEW",
    limitationNote:
      "เว็บไซต์ Official ไม่มีรายการข่าวพร้อมวันที่แบบ server-rendered หรือ public feed ที่เสถียร",
  },
  {
    gameSlug: "digimon-up",
    name: "DIGIMON UP Official",
    url: "https://dgup.bn-ent.net/en/news/",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "en",
    adapterKey: "digimon-up-official-news",
    automationMode: "ADAPTER",
    limitationNote:
      "อ่าน newsCard จากหน้า News ภาษาอังกฤษของ Bandai Namco โดยตรง",
  },
  {
    gameSlug: "soul-land-awakening-world",
    name: "Soul Land: Awakening World Official",
    url: "https://gevents.37games.com/official_slmsea/index.html",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "en",
    adapterKey: "soul-land-awakening-world-manual",
    automationMode: "MANUAL_REVIEW",
    limitationNote:
      "รายการข่าวใช้ API ภายในที่ไม่มี public contract จึงให้ Admin ตรวจแหล่ง Official",
  },
  {
    gameSlug: "honkai-star-rail",
    name: "Honkai: Star Rail Official",
    url: "https://hsr.hoyoverse.com/en-us/news",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "en",
    adapterKey: "honkai-star-rail-manual",
    automationMode: "MANUAL_REVIEW",
    limitationNote:
      "HoYoverse โหลดข่าวผ่านบริการภายในที่ไม่มี public contract จึงไม่เรียก endpoint ภายใน",
  },
  {
    gameSlug: "love-and-deepspace",
    name: "Love and Deepspace Official",
    url: "https://loveanddeepspace.infoldgames.com/en-EN/",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "en",
    adapterKey: "love-and-deepspace-manual",
    automationMode: "MANUAL_REVIEW",
    limitationNote:
      "หน้า list ข่าวไม่มีสัญญาสาธารณะที่เสถียร จึงให้ Admin ตรวจบทความ Official รายชิ้น",
  },
  {
    gameSlug: "genshin-impact",
    name: "Genshin Impact Official",
    url: "https://genshin.hoyoverse.com/en/news",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "en",
    adapterKey: "genshin-impact-manual",
    automationMode: "MANUAL_REVIEW",
    limitationNote:
      "HoYoverse โหลดข่าวแบบ dynamic ผ่านบริการภายในที่ไม่มี public contract",
  },
  {
    gameSlug: "wuthering-waves",
    name: "Wuthering Waves Official",
    url: "https://wutheringwaves.kurogames.com/en/main/news",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "en",
    adapterKey: "wuthering-waves-manual",
    automationMode: "MANUAL_REVIEW",
    limitationNote:
      "หน้า News เป็น dynamic shell และไม่มี public feed contract ที่เสถียร",
  },
  {
    gameSlug: "valorant",
    name: "VALORANT Thailand Official",
    url: "https://playvalorant.com/th-th/news/",
    sourceType: "OFFICIAL_WEBSITE",
    credibilityScore: 100,
    language: "th",
    adapterKey: "valorant-thailand-news",
    automationMode: "ADAPTER",
    limitationNote:
      "อ่านเฉพาะ Game Updates และ Announcements ภาษาไทยจาก Riot Official โดยไม่รวม Esports",
  },
] as const;

export const GAME_CONTENT_SOURCE_SEEDS = [
  ...GAME_CONTENT_PRIMARY_SOURCE_SEEDS,
  ...GAME_CONTENT_SOCIAL_SOURCE_SEEDS,
] as const;

export function gameContentIconPath(slug: string) {
  return `/game-icons/${slug}.${slug === "valorant" ? "png" : "jpg"}`;
}
