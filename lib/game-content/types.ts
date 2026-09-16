export const ACTIVITY_TYPES = [
  "NEW_CHARACTER",
  "NEW_SKIN",
  "NEW_ITEM",
  "NEW_PACKAGE",
  "BATTLE_PASS",
  "TOPUP_EVENT",
  "GACHA",
  "COLLABORATION",
  "ANNIVERSARY",
  "SEASON_UPDATE",
  "VERSION_UPDATE",
  "NEW_MODE",
  "NEW_MAP",
  "REDEEM_CODE",
  "SALE",
  "OTHER",
] as const;

export const VERIFICATION_STATUSES = [
  "OFFICIAL",
  "CONFIRMED",
  "TEASER",
  "RUMOR",
  "DATAMINED",
  "UNKNOWN",
] as const;

export const CONTENT_STATUSES = [
  "DISCOVERED",
  "REVIEWING",
  "APPROVED",
  "PLANNED",
  "DESIGNING",
  "SCHEDULED",
  "PUBLISHED",
  "SKIPPED",
  "EXPIRED",
] as const;

export const SOURCE_TYPES = [
  "OFFICIAL_WEBSITE",
  "OFFICIAL_SOCIAL",
  "IN_GAME",
  "APP_STORE",
  "OFFICIAL_COMMUNITY",
  "TRUSTED_MEDIA",
  "COMMUNITY",
  "DATAMINING",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type SourceAutomationMode =
  | "ADAPTER"
  | "SEARCH_DISCOVERY"
  | "MANUAL_REVIEW";
export type ContentPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
export type GameContentRole = "ADMIN" | "EDITOR" | "VIEWER";

export type GameContentGame = {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type GameContentSource = {
  id: string;
  gameId: string;
  gameName: string;
  name: string;
  url: string;
  sourceType: SourceType;
  credibilityScore: number;
  language: string;
  isActive: boolean;
  adapterKey: string | null;
  automationMode: SourceAutomationMode;
  limitationNote: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type GameActivity = {
  id: string;
  gameId: string;
  gameSlug: string;
  gameName: string;
  title: string;
  originalTitle: string | null;
  activityType: ActivityType;
  description: string;
  startDate: string | null;
  endDate: string | null;
  announcementDate: string | null;
  expectedReleaseDate: string | null;
  region: string;
  platform: string;
  sourceName: string;
  sourceUrl: string;
  sourceType: SourceType;
  sourcePublishedAt: string | null;
  discoveredAt: string;
  verificationStatus: VerificationStatus;
  confidenceScore: number;
  popularityScore: number;
  monetizationScore: number;
  urgencyScore: number;
  contentPriority: ContentPriority;
  contentPriorityScore: number;
  contentDeadline: string | null;
  recommendedPublishDate: string | null;
  thumbnailUrl: string | null;
  officialImageUrl: string | null;
  tags: string[];
  aiSummaryTh: string | null;
  aiCaptionTh: string | null;
  contentAngle: string | null;
  status: ContentStatus;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string;
};

export type GeneratedGameContent = {
  summary: {
    whatHappened: string;
    startsAt: string;
    endsAt: string;
    playerBenefit: string;
    topupRelevance: string;
    verification: string;
  };
  contentAngles: string[];
  captions: {
    news: string;
    friendly: string;
    thunderTopup: string;
  };
  designBrief: {
    headline: string;
    subheadline: string;
    imageText: string;
    subject: string;
    colorTone: string;
    aspectRatio: string;
    callToAction: string;
    prohibitedClaims: string[];
  };
  warning: string | null;
};

export type ActivityFilters = {
  gameId?: string;
  activityType?: ActivityType;
  priority?: ContentPriority;
  verificationStatus?: VerificationStatus;
  status?: ContentStatus;
  dateFrom?: string;
  dateTo?: string;
  region?: string;
  platform?: string;
  highMonetization?: boolean;
  hasOfficialImage?: boolean;
  withoutContent?: boolean;
  view?: string;
};
