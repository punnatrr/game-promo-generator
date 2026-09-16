import { getDb, hasDatabaseUrl } from "@/lib/db";
import type { SubscriptionPlan } from "./plans";
import type { SubscriptionStatus } from "./quota";

export type ActiveSubscriptionAccess = {
  userId: string;
  subscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  usedImagesThisPeriod: number;
  plan: SubscriptionPlan;
};

type AccessRow = {
  user_id: string;
  subscription_id: string;
  status: SubscriptionStatus;
  current_period_start: Date;
  current_period_end: Date;
  slug: string;
  name: string;
  description: string | null;
  price_monthly_thb: number;
  monthly_image_limit: number;
  has_special_features: boolean;
  has_vip_support: boolean;
  history_retention_days: number;
  max_images_per_generation: number;
  used_images_this_period: number | string | null;
};

export function canUseDatabaseBackedSubscriptions() {
  return hasDatabaseUrl();
}

export async function getActiveSubscriptionAccessByUserId(
  userId: string
): Promise<ActiveSubscriptionAccess | null> {
  const db = getDb();
  const [row] = await db<AccessRow[]>`
    select
      s.user_id,
      s.id as subscription_id,
      s.status,
      s.current_period_start,
      s.current_period_end,
      p.slug,
      p.name,
      p.description,
      p.price_monthly_thb,
      p.monthly_image_limit,
      p.has_special_features,
      p.has_vip_support,
      p.history_retention_days,
      p.max_images_per_generation,
      coalesce(sum(u.image_count), 0) as used_images_this_period
    from subscriptions s
    join plans p on p.id = s.plan_id
    left join usage_events u
      on u.subscription_id = s.id
      and u.created_at >= s.current_period_start
      and u.created_at < s.current_period_end
    where s.user_id = ${userId}
      and s.status = 'active'
      and s.current_period_start <= now()
      and s.current_period_end > now()
    group by s.id, p.id
    order by s.current_period_end desc
    limit 1
  `;

  if (!row) return null;

  return {
    userId: row.user_id,
    subscriptionId: row.subscription_id,
    status: row.status,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    usedImagesThisPeriod: Number(row.used_images_this_period ?? 0),
    plan: {
      slug: row.slug as SubscriptionPlan["slug"],
      name: row.name,
      description: row.description || "",
      priceMonthlyThb: row.price_monthly_thb,
      monthlyImageLimit: row.monthly_image_limit,
      hasSpecialFeatures: row.has_special_features,
      hasVipSupport: row.has_vip_support,
      historyRetentionDays: row.history_retention_days,
      maxImagesPerGeneration: row.max_images_per_generation,
    },
  };
}

export async function recordUsageEvent({
  userId,
  subscriptionId,
  planSlug,
  action,
  imageCount,
  model,
}: {
  userId: string;
  subscriptionId: string;
  planSlug: string;
  action: "generate" | "refine";
  imageCount: number;
  model: string;
}) {
  if (imageCount <= 0) return;

  const db = getDb();
  await db`
    insert into usage_events (
      user_id,
      subscription_id,
      plan_id,
      action,
      image_count,
      model
    )
    select
      ${userId},
      ${subscriptionId},
      p.id,
      ${action},
      ${imageCount},
      ${model}
    from plans p
    where p.slug = ${planSlug}
  `;
}
