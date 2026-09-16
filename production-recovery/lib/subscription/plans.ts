export type SubscriptionPlanSlug = "basic" | "pro" | "business";

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

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlanSlug,
  SubscriptionPlan
> = {
  basic: {
    slug: "basic",
    name: "Basic",
    description: "15 รูปต่อเดือน สำหรับเริ่มใช้งาน",
    priceMonthlyThb: 199,
    monthlyImageLimit: 15,
    hasSpecialFeatures: false,
    hasVipSupport: false,
    historyRetentionDays: 30,
    maxImagesPerGeneration: 5,
  },
  pro: {
    slug: "pro",
    name: "Pro",
    description: "30 รูปต่อเดือน พร้อมฟีเจอร์พิเศษ",
    priceMonthlyThb: 499,
    monthlyImageLimit: 30,
    hasSpecialFeatures: true,
    hasVipSupport: false,
    historyRetentionDays: 30,
    maxImagesPerGeneration: 5,
  },
  business: {
    slug: "business",
    name: "Business",
    description: "100 รูปต่อเดือน พร้อมฟีเจอร์พิเศษและบริการ VIP",
    priceMonthlyThb: 999,
    monthlyImageLimit: 100,
    hasSpecialFeatures: true,
    hasVipSupport: true,
    historyRetentionDays: 30,
    maxImagesPerGeneration: 5,
  },
};

export const PLAN_ORDER: SubscriptionPlanSlug[] = [
  "basic",
  "pro",
  "business",
];

export function getSubscriptionPlan(slug: string) {
  return SUBSCRIPTION_PLANS[slug as SubscriptionPlanSlug] ?? null;
}
