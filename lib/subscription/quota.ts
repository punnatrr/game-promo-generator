import type { SubscriptionPlan } from "./plans";

export type SubscriptionStatus =
  | "active"
  | "pending_payment"
  | "past_due"
  | "canceled"
  | "expired";

export type QuotaCheckInput = {
  plan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  usedImagesThisPeriod: number;
  requestedImages: number;
  now?: Date;
  currentPeriodEnd?: Date;
};

export type QuotaCheckResult = {
  allowed: boolean;
  remainingImages: number;
  billableImageCount: number;
  reason?: "inactive_subscription" | "expired_subscription" | "too_many_images" | "quota_exceeded";
};

export function getRemainingImages({
  plan,
  usedImagesThisPeriod,
}: {
  plan: SubscriptionPlan;
  usedImagesThisPeriod: number;
}) {
  return Math.max(plan.monthlyImageLimit - usedImagesThisPeriod, 0);
}

export function checkImageQuota({
  plan,
  subscriptionStatus,
  usedImagesThisPeriod,
  requestedImages,
  now = new Date(),
  currentPeriodEnd,
}: QuotaCheckInput): QuotaCheckResult {
  const remainingImages = getRemainingImages({
    plan,
    usedImagesThisPeriod,
  });
  const billableImageCount = Math.max(requestedImages, 0);

  if (subscriptionStatus !== "active") {
    return {
      allowed: false,
      remainingImages,
      billableImageCount,
      reason: "inactive_subscription",
    };
  }

  if (currentPeriodEnd && currentPeriodEnd.getTime() <= now.getTime()) {
    return {
      allowed: false,
      remainingImages: 0,
      billableImageCount,
      reason: "expired_subscription",
    };
  }

  if (billableImageCount > plan.maxImagesPerGeneration) {
    return {
      allowed: false,
      remainingImages,
      billableImageCount,
      reason: "too_many_images",
    };
  }

  if (billableImageCount > remainingImages) {
    return {
      allowed: false,
      remainingImages,
      billableImageCount,
      reason: "quota_exceeded",
    };
  }

  return {
    allowed: true,
    remainingImages,
    billableImageCount,
  };
}

export function countSuccessfulGeneratedImages(images: unknown[]) {
  return images.filter((image) => typeof image === "string" && image.length > 0)
    .length;
}
