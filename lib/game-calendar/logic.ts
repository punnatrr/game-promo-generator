import type { ActivityType, GameActivity } from "@/lib/game-content/types";

import type {
  CalendarCategory,
  CalendarEvent,
  CalendarStatus,
  ScoreReason,
} from "./types";

const ACTIVITY_CATEGORY_MAP: Record<ActivityType, CalendarCategory> = {
  NEW_CHARACTER: "CHARACTER",
  NEW_SKIN: "SKIN",
  NEW_ITEM: "ITEM",
  NEW_PACKAGE: "PACKAGE",
  BATTLE_PASS: "BATTLE_PASS",
  TOPUP_EVENT: "TOP_UP_EVENT",
  GACHA: "GACHA",
  COLLABORATION: "COLLABORATION",
  ANNIVERSARY: "IN_GAME_EVENT",
  SEASON_UPDATE: "VERSION_UPDATE",
  VERSION_UPDATE: "VERSION_UPDATE",
  NEW_MODE: "NEW_MODE",
  NEW_MAP: "NEW_MAP",
  REDEEM_CODE: "IN_GAME_EVENT",
  SALE: "TOP_UP_EVENT",
  OTHER: "OTHER",
};

export const CALENDAR_CATEGORY_LABELS_TH: Record<CalendarCategory, string> = {
  CHARACTER: "ตัวละคร",
  SKIN: "สกิน",
  ITEM: "ไอเทม",
  GACHA: "กาชา/ตู้สุ่ม",
  BATTLE_PASS: "Battle Pass",
  PATCH: "แพตช์",
  VERSION_UPDATE: "อัปเดตเวอร์ชัน",
  IN_GAME_EVENT: "กิจกรรมในเกม",
  COLLABORATION: "คอลแลบ",
  NEW_MODE: "โหมดใหม่",
  NEW_MAP: "แผนที่ใหม่",
  TOP_UP_EVENT: "กิจกรรมเติมเงิน",
  PACKAGE: "แพ็กเกจ",
  PRE_REGISTRATION: "ลงทะเบียนล่วงหน้า",
  MAINTENANCE: "ปิดปรับปรุง",
  LIVESTREAM: "ไลฟ์ประกาศ",
  ESPORTS: "อีสปอร์ต",
  COMMUNITY_TREND: "กระแสคอมมูนิตี้",
  OTHER: "อื่น ๆ",
};

export const CALENDAR_STATUS_LABELS_TH: Record<CalendarStatus, string> = {
  NEW: "ประกาศล่าสุด",
  UPCOMING: "กำลังจะเริ่ม",
  STARTS_TODAY: "เริ่มวันนี้",
  ACTIVE: "กำลังดำเนินอยู่",
  ENDING_SOON: "ใกล้สิ้นสุด",
  ENDED: "สิ้นสุดแล้ว",
  UNCONFIRMED: "ยังไม่ยืนยัน",
  REVIEW: "รอตรวจสอบ",
  CANCELLED: "ถูกยกเลิก",
  POSTPONED: "เลื่อนกำหนดการ",
  UNSCHEDULED: "ยังไม่ประกาศวัน",
};

function bangkokDay(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function calculateCalendarStatus(
  input: {
    startDate: string | null;
    endDate: string | null;
    announcementDate: string | null;
    isRumor: boolean;
    requiresReview: boolean;
    workflowStatus?: string;
  },
  now = new Date()
): CalendarStatus {
  if (input.workflowStatus === "CANCELLED") return "CANCELLED";
  if (input.workflowStatus === "POSTPONED") return "POSTPONED";
  if (input.isRumor) return "UNCONFIRMED";
  if (input.requiresReview) return "REVIEW";
  if (!input.startDate) {
    const announcedAt = input.announcementDate
      ? new Date(input.announcementDate).getTime()
      : Number.NaN;
    if (
      Number.isFinite(announcedAt) &&
      now.getTime() - announcedAt <= 24 * 60 * 60 * 1000
    ) {
      return "NEW";
    }
    return "UNSCHEDULED";
  }

  const start = new Date(input.startDate);
  const end = input.endDate ? new Date(input.endDate) : null;
  if (end && end.getTime() < now.getTime()) return "ENDED";
  if (bangkokDay(start) === bangkokDay(now)) return "STARTS_TODAY";
  if (start.getTime() > now.getTime()) return "UPCOMING";
  if (
    end &&
    end.getTime() >= now.getTime() &&
    end.getTime() - now.getTime() <= 3 * 86_400_000
  ) {
    return "ENDING_SOON";
  }
  return "ACTIVE";
}

export function buildDeduplicationKey(input: {
  gameId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  version?: string | null;
}) {
  return [
    input.gameId,
    input.title.normalize("NFKC").toLocaleLowerCase("th").replace(/\s+/g, " "),
    input.startDate?.slice(0, 10) || "",
    input.endDate?.slice(0, 10) || "",
    input.version?.toLocaleLowerCase("en") || "",
  ].join("|");
}

function scoreReasons(activity: GameActivity) {
  const official = ["OFFICIAL", "CONFIRMED", "TEASER"].includes(
    activity.verificationStatus
  );
  const importanceReasons: string[] = [];
  if (official) importanceReasons.push("มีแหล่งประกาศทางการ");
  if (
    ["NEW_CHARACTER", "NEW_SKIN", "VERSION_UPDATE", "SEASON_UPDATE"].includes(
      activity.activityType
    )
  ) {
    importanceReasons.push("เป็นอัปเดตหลักที่ผู้เล่นติดตาม");
  }
  if (activity.urgencyScore >= 70) importanceReasons.push("ใกล้วันเริ่มหรือมีเวลาจำกัด");

  const interestReasons = [
    activity.popularityScore >= 70
      ? "มีสัญญาณความสนใจสูง"
      : "ยังมีข้อมูล engagement จำกัด",
  ];
  const opportunityReasons: string[] = [];
  if (activity.monetizationScore >= 70) {
    opportunityReasons.push("เกี่ยวข้องกับโอกาสเติมเกมหรือแพ็กเกจ");
  }
  if (activity.contentPriorityScore >= 65) {
    opportunityReasons.push("เหมาะกับโพสต์แจ้งข่าวหรือคอนเทนต์เร่งด่วน");
  }
  if (opportunityReasons.length === 0) {
    opportunityReasons.push("เหมาะกับโพสต์สรุปข่าวทั่วไป");
  }

  return {
    importance: {
      score: Math.max(
        activity.confidenceScore,
        Math.round(
          activity.popularityScore * 0.45 +
            activity.urgencyScore * 0.35 +
            (official ? 20 : 0)
        )
      ),
      reasons: importanceReasons.length
        ? importanceReasons
        : ["ข้อมูลยังไม่ครบถ้วน ต้องประเมินเพิ่มเติม"],
    } satisfies ScoreReason,
    communityInterest: {
      score: activity.popularityScore,
      reasons: interestReasons,
    } satisfies ScoreReason,
    contentOpportunity: {
      score: activity.contentPriorityScore,
      reasons: opportunityReasons,
    } satisfies ScoreReason,
  };
}

function inferCategory(activity: GameActivity): CalendarCategory {
  if (activity.activityType !== "OTHER") {
    return ACTIVITY_CATEGORY_MAP[activity.activityType];
  }
  const content = `${activity.title} ${activity.description}`.toLowerCase();
  if (/maintenance|ปิดปรับปรุง/.test(content)) return "MAINTENANCE";
  if (/livestream|special program|ไลฟ์/.test(content)) return "LIVESTREAM";
  if (/esports|tournament|การแข่งขัน/.test(content)) return "ESPORTS";
  if (/pre.?registration|ลงทะเบียนล่วงหน้า/.test(content)) {
    return "PRE_REGISTRATION";
  }
  return "OTHER";
}

export function activityToCalendarEvent(
  activity: GameActivity,
  gameIconUrl: string | null,
  now = new Date()
): CalendarEvent {
  const isOfficial = ["OFFICIAL", "CONFIRMED", "TEASER"].includes(
    activity.verificationStatus
  );
  const isRumor = ["RUMOR", "DATAMINED", "UNKNOWN"].includes(
    activity.verificationStatus
  );
  const requiresReview = ["DISCOVERED", "REVIEWING"].includes(activity.status);
  const status = calculateCalendarStatus(
    {
      startDate: activity.startDate,
      endDate: activity.endDate,
      announcementDate: activity.announcementDate || activity.sourcePublishedAt,
      isRumor,
      requiresReview,
      workflowStatus: activity.status,
    },
    now
  );
  const scores = scoreReasons(activity);
  const contentAngles = activity.contentAngle
    ? [activity.contentAngle]
    : ["สรุปสิ่งที่ประกาศและผลกระทบต่อผู้เล่น", "ทำ Calendar Reminder ก่อนเริ่ม"];

  return {
    id: activity.id,
    gameId: activity.gameId,
    gameSlug: activity.gameSlug,
    gameName: activity.gameName,
    gameIconUrl,
    title: activity.title,
    titleTh: activity.title,
    summary: activity.description,
    summaryTh:
      activity.aiSummaryTh || activity.description || "ข้อมูลยังไม่ครบถ้วน",
    category: inferCategory(activity),
    subcategory: null,
    announcementDate: activity.announcementDate || activity.sourcePublishedAt,
    startDate: activity.startDate || activity.expectedReleaseDate,
    endDate: activity.endDate,
    timezone: "Asia/Bangkok",
    region: activity.region || "Global",
    server: activity.platform || "ALL",
    status,
    statusLabelTh: CALENDAR_STATUS_LABELS_TH[status],
    version: null,
    patchNumber: null,
    featuredCharacters:
      activity.activityType === "NEW_CHARACTER" ? activity.tags : [],
    featuredSkins: activity.activityType === "NEW_SKIN" ? activity.tags : [],
    featuredItems: activity.activityType === "NEW_ITEM" ? activity.tags : [],
    officialImage: activity.officialImageUrl || activity.thumbnailUrl,
    sourceType: activity.sourceType,
    sourceUrls: [activity.sourceUrl],
    officialSourceUrl: isOfficial ? activity.sourceUrl : null,
    communitySourceUrls: isOfficial ? [] : [activity.sourceUrl],
    confidenceScore: activity.confidenceScore,
    importance: scores.importance,
    communityInterest: scores.communityInterest,
    contentOpportunity: scores.contentOpportunity,
    contentAngles,
    keywords: activity.tags,
    isOfficial,
    isRumor,
    requiresReview,
    reviewStatus: requiresReview ? "PENDING" : "APPROVED",
    publishedStatus:
      activity.status === "PUBLISHED" ? "PUBLISHED" : "APPROVED",
    isFeatured: activity.isFeatured,
    firstDetectedAt: activity.discoveredAt,
    lastCheckedAt: activity.lastCheckedAt,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
    deduplicationKey: buildDeduplicationKey({
      gameId: activity.gameId,
      title: activity.title,
      startDate: activity.startDate,
      endDate: activity.endDate,
    }),
    conflictWarning: null,
    isDemo: false,
  };
}

export function mergeCalendarEvents(events: CalendarEvent[]) {
  const merged = new Map<string, CalendarEvent>();
  for (const event of events) {
    const current = merged.get(event.deduplicationKey);
    if (!current) {
      merged.set(event.deduplicationKey, event);
      continue;
    }
    const official = current.isOfficial ? current : event.isOfficial ? event : current;
    const other = official.id === current.id ? event : current;
    merged.set(event.deduplicationKey, {
      ...official,
      sourceUrls: Array.from(
        new Set([...official.sourceUrls, ...other.sourceUrls])
      ),
      communitySourceUrls: Array.from(
        new Set([
          ...official.communitySourceUrls,
          ...other.communitySourceUrls,
        ])
      ),
      confidenceScore: Math.max(
        official.confidenceScore,
        other.confidenceScore
      ),
      conflictWarning:
        official.startDate !== other.startDate || official.endDate !== other.endDate
          ? "แหล่งข้อมูลระบุวันเวลาไม่ตรงกัน กรุณาตรวจสอบ"
          : official.conflictWarning,
    });
  }
  return Array.from(merged.values());
}
