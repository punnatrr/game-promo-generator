import { getDb, hasDatabaseUrl } from "@/lib/db";
import { ADMIN_SUBSCRIPTION_PLAN, type SubscriptionPlan } from "./plans";
import type { SubscriptionStatus } from "./quota";

export type ActiveSubscriptionAccess = {
  userId: string;
  subscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  usedImagesThisPeriod: number;
  plan: SubscriptionPlan;
  isAdminPackage?: boolean;
};

type AccessRow = {
  user_id: string;
  subscription_id: string;
  status: SubscriptionStatus;
  current_period_start: Date;
  current_period_end: Date;
  slug: SubscriptionPlan["slug"];
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

type PlanRow = {
  slug: SubscriptionPlan["slug"];
  name: string;
  description: string | null;
  price_monthly_thb: number;
  monthly_image_limit: number;
  has_special_features: boolean;
  has_vip_support: boolean;
  history_retention_days: number;
  max_images_per_generation: number;
};

function toSubscriptionPlan(row: PlanRow): SubscriptionPlan {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description || "",
    priceMonthlyThb: row.price_monthly_thb,
    monthlyImageLimit: row.monthly_image_limit,
    hasSpecialFeatures: row.has_special_features,
    hasVipSupport: row.has_vip_support,
    historyRetentionDays: row.history_retention_days,
    maxImagesPerGeneration: row.max_images_per_generation,
  };
}

export function canUseDatabaseBackedSubscriptions() {
  return hasDatabaseUrl();
}

export async function listActiveSubscriptionPlans() {
  const db = getDb();
  const rows = await db<PlanRow[]>`
    select
      slug,
      name,
      description,
      price_monthly_thb,
      monthly_image_limit,
      has_special_features,
      has_vip_support,
      history_retention_days,
      max_images_per_generation
    from plans
    where is_active = true
    order by sort_order asc, price_monthly_thb asc, slug asc
  `;

  return rows.map(toSubscriptionPlan);
}

export function createAdminSubscriptionAccess(userId: string): ActiveSubscriptionAccess {
  const currentPeriodStart = new Date();
  const currentPeriodEnd = new Date(currentPeriodStart);
  currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);

  return {
    userId,
    subscriptionId: null,
    status: "active",
    currentPeriodStart,
    currentPeriodEnd,
    usedImagesThisPeriod: 0,
    plan: ADMIN_SUBSCRIPTION_PLAN,
    isAdminPackage: true,
  };
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
      s.plan_slug_snapshot as slug,
      s.plan_name_snapshot as name,
      s.plan_description_snapshot as description,
      s.price_monthly_thb_snapshot as price_monthly_thb,
      s.monthly_image_limit_snapshot as monthly_image_limit,
      s.has_special_features_snapshot as has_special_features,
      s.has_vip_support_snapshot as has_vip_support,
      s.history_retention_days_snapshot as history_retention_days,
      s.max_images_per_generation_snapshot as max_images_per_generation,
      coalesce(sum(u.image_count), 0) as used_images_this_period
    from subscriptions s
    left join usage_events u
      on u.subscription_id = s.id
      and u.created_at >= s.current_period_start
      and u.created_at < s.current_period_end
    where s.user_id = ${userId}
      and s.status = 'active'
      and s.current_period_start <= now()
      and s.current_period_end > now()
    group by s.id
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
    plan: toSubscriptionPlan(row),
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
  subscriptionId: string | null;
  planSlug: string;
  action: "generate" | "refine";
  imageCount: number;
  model: string;
}) {
  if (imageCount <= 0) return;

  const db = getDb();

  if (!subscriptionId || planSlug === "admin") {
    await db`
      insert into usage_events (
        user_id,
        subscription_id,
        plan_id,
        action,
        image_count,
        model
      )
      values (
        ${userId},
        null,
        null,
        ${action},
        ${imageCount},
        ${model}
      )
    `;
    return;
  }

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
