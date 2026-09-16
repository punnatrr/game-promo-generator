import type {
  ActivityType,
  GameContentSource,
  SourceAutomationMode,
} from "../types";

export type SourceAdapterItem = {
  externalId: string;
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  activityType: ActivityType;
  platform: string;
  thumbnailUrl: string | null;
  popularityScore?: number;
  tags: string[];
};

export type SourceAdapterResult = {
  mode: SourceAutomationMode;
  items: SourceAdapterItem[];
  limitationNote: string | null;
};

export type ManualReviewInput = {
  title: string;
  description?: string;
  sourceUrl: string;
  publishedAt: string;
};

export interface GameSourceAdapter {
  readonly key: string;
  readonly gameSlug: string;
  readonly mode: SourceAutomationMode;
  readonly limitationNote: string | null;
  fetch(source: GameContentSource): Promise<SourceAdapterResult>;
}
