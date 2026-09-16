export type SubscriptionPlanSlug =
  | "trial"
  | "basic"
  | "pro"
  | "business"
  | "admin";

export type SubscriptionPlan = {
  slug: SubscriptionPlanSlug;
  name: string;
  description: string;
  priceMonthlyThb: number;
  monthlyImageLimit: number;
  hasSpecialFeatures: boolean;
  hasVipSupport: boolean;
  historyRetentionDays: number;
  maxImagesPerGeneration: number;
};

export const ADMIN_SUBSCRIPTION_PLAN: SubscriptionPlan = {
  slug: "admin",
  name: "ADMIN",
  description: "Special admin package with no paid subscription required.",
  priceMonthlyThb: 0,
  monthlyImageLimit: 999999,
  hasSpecialFeatures: true,
  hasVipSupport: true,
  historyRetentionDays: 365,
  maxImagesPerGeneration: 5,
};
