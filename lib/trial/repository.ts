import { getDb } from "@/lib/db";

export type TrialRedemptionOutcome =
  | "redeemed"
  | "invalid_code"
  | "already_redeemed"
  | "active_subscription"
  | "redemption_limit_reached";

type PromoCodeRow = {
  id: string;
  plan_id: string;
  max_redemptions: number | null;
};

export async function redeemTrialCodeForUser({
  userId,
  codeHash,
}: {
  userId: string;
  codeHash: string;
}): Promise<{ outcome: TrialRedemptionOutcome; subscriptionId?: string }> {
  const db = getDb();

  return db.begin(async (sql) => {
    await sql`
      select pg_advisory_xact_lock(
        hashtextextended(${`trial-redemption:${userId}`}, 0)
      )
    `;

    const [promoCode] = await sql<PromoCodeRow[]>`
      select promo.id, promo.plan_id, promo.max_redemptions
      from promo_codes promo
      join plans plan on plan.id = promo.plan_id
      where promo.code_hash = ${codeHash}
        and promo.is_active = true
        and promo.starts_at <= now()
        and (promo.expires_at is null or promo.expires_at > now())
        and plan.slug = 'trial'
      limit 1
      for update of promo
    `;

    if (!promoCode) return { outcome: "invalid_code" };

    const [existingRedemption] = await sql<{ id: string }[]>`
      select id
      from promo_code_redemptions
      where user_id = ${userId}
      limit 1
    `;

    if (existingRedemption) return { outcome: "already_redeemed" };

    await sql`
      update subscriptions
      set status = 'expired', updated_at = now()
      where user_id = ${userId}
        and status = 'active'
        and current_period_end <= now()
    `;

    const [activeSubscription] = await sql<{ id: string }[]>`
      select id
      from subscriptions
      where user_id = ${userId}
        and status = 'active'
        and current_period_end > now()
      limit 1
    `;

    if (activeSubscription) return { outcome: "active_subscription" };

    if (promoCode.max_redemptions !== null) {
      const [redemptionCount] = await sql<{ count: number | string }[]>`
        select count(*) as count
        from promo_code_redemptions
        where promo_code_id = ${promoCode.id}
      `;

      if (Number(redemptionCount?.count ?? 0) >= promoCode.max_redemptions) {
        return { outcome: "redemption_limit_reached" };
      }
    }

    const [subscription] = await sql<{ id: string }[]>`
      insert into subscriptions (
        user_id,
        plan_id,
        status,
        payment_method,
        current_period_start,
        current_period_end,
        currency,
        plan_slug_snapshot,
        plan_name_snapshot,
        plan_description_snapshot,
        price_monthly_thb_snapshot,
        monthly_image_limit_snapshot,
        has_special_features_snapshot,
        has_vip_support_snapshot,
        history_retention_days_snapshot,
        max_images_per_generation_snapshot
      )
      select
        ${userId},
        plan.id,
        'active',
        'manual',
        now(),
        now() + interval '100 years',
        'THB',
        plan.slug,
        plan.name,
        coalesce(plan.description, ''),
        plan.price_monthly_thb,
        plan.monthly_image_limit,
        plan.has_special_features,
        plan.has_vip_support,
        plan.history_retention_days,
        plan.max_images_per_generation
      from plans plan
      where plan.id = ${promoCode.plan_id}
      returning id
    `;

    if (!subscription) return { outcome: "invalid_code" };

    await sql`
      insert into promo_code_redemptions (
        promo_code_id,
        user_id,
        subscription_id
      )
      values (
        ${promoCode.id},
        ${userId},
        ${subscription.id}
      )
    `;

    return {
      outcome: "redeemed",
      subscriptionId: subscription.id,
    };
  });
}
