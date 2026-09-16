export const CALENDAR_CATEGORIES = [
  "CHARACTER",
  "SKIN",
  "ITEM",
  "GACHA",
  "BATTLE_PASS",
  "PATCH",
  "VERSION_UPDATE",
  "IN_GAME_EVENT",
  "COLLABORATION",
  "NEW_MODE",
  "NEW_MAP",
  "TOP_UP_EVENT",
  "PACKAGE",
  "PRE_REGISTRATION",
  "MAINTENANCE",
  "LIVESTREAM",
  "ESPORTS",
  "COMMUNITY_TREND",
  "OTHER",
] as const;

export const CALENDAR_STATUSES = [
  "NEW",
  "UPCOMING",
  "STARTS_TODAY",
  "ACTIVE",
  "ENDING_SOON",
  "ENDED",
  "UNCONFIRMED",
  "REVIEW",
  "CANCELLED",
  "POSTPONED",
  "UNSCHEDULED",
] as const;

export type CalendarCategory = (typeof CALENDAR_CATEGORIES)[number];
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];
export type CalendarView = "month" | "week" | "agenda" | "list" | "timeline";

export type ScoreReason = {
  score: number;
  reasons: string[];
};

export type CalendarGame = {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
};

export type CalendarEvent = {
  id: string;
  gameId: string;
  gameSlug: string;
  gameName: string;
  gameIconUrl: string | null;
  title: string;
  titleTh: string;
  summary: string;
  summaryTh: string;
  category: CalendarCategory;
  subcategory: string | null;
  announcementDate: string | null;
  startDate: string | null;
  endDate: string | null;
  timezone: "Asia/Bangkok";
  region: string;
  server: string;
  status: CalendarStatus;
  statusLabelTh: string;
  version: string | null;
  patchNumber: string | null;
  featuredCharacters: string[];
  featuredSkins: string[];
  featuredItems: string[];
  officialImage: string | null;
  sourceType: string;
  sourceUrls: string[];
  officialSourceUrl: string | null;
  communitySourceUrls: string[];
  confidenceScore: number;
  importance: ScoreReason;
  communityInterest: ScoreReason;
  contentOpportunity: ScoreReason;
  contentAngles: string[];
  keywords: string[];
  isOfficial: boolean;
  isRumor: boolean;
  requiresReview: boolean;
  reviewStatus: string;
  publishedStatus: string;
  isFeatured: boolean;
  firstDetectedAt: string;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
  deduplicationKey: string;
  conflictWarning: string | null;
  isDemo: boolean;
};

export type CalendarEventFilters = {
  game?: string;
  category?: CalendarCategory;
  status?: CalendarStatus;
  region?: string;
  server?: string;
  officialOnly?: boolean;
  communityTrend?: boolean;
  minImportance?: number;
  minOpportunity?: number;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  upcomingDays?: 7 | 30;
  newToday?: boolean;
  endingSoon?: boolean;
  unconfirmed?: boolean;
  sort?: "start_asc" | "start_desc" | "importance" | "opportunity" | "newest";
  page?: number;
  limit?: number;
};
