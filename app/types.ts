export type ImageSlot = "image1" | "image2" | "image3";

export type ImageSizeValue = "1:1" | "3:4" | "4:5" | "9:16" | "4:3" | "16:9";

export type ResultCount = 1 | 2 | 3 | 4 | 5;

export type AiModel = "gpt-image-1.5" | "gpt-image-2" | "gpt-image-3";

export type ImageQuality = "low" | "medium" | "high";

export type SpecialFeatureStyle =
  | "brand-colors"
  | "brand-layout"
  | "logo-qr"
  | "full-brand";

export type HistoryItem = {
  id: string;
  image: string;
  shop: string;
  aspectRatio: ImageSizeValue;
  createdAt: string;
};
