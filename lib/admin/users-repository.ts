import { getDb } from "@/lib/db";
import { ADMIN_SUBSCRIPTION_PLAN } from "@/lib/subscription/plans";

export type AdminUserRole = "user" | "admin";

export type AdminUserListItem = {
  id: string;
  email: string;
  displayName: string | null;
  role: AdminUserRole;
  createdAt: string;
  updatedAt: string;
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    planSlug: string;
    planName: string;
    priceMonthlyThb: number;
    monthlyImageLimit: number;
    usedImagesThisPeriod: number;
    remainingImages: number;
  } | null;
  paymentSummary: {
    totalPayments: number;
    paidPayments: number;
    pendingPayments: number;
    totalPaidThb: number;
  };
};

type AdminUserRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: AdminUserRole;
  created_at: Date;
  updated_at: Date;
  subscription_id: string | null;
  subscription_status: string | null;
  current_period_start: Date | null;
  current_period_end: Date | null;
  plan_slug: string | null;
  plan_name: string | null;
  price_monthly_thb: number | null;
  monthly_image_limit: number | null;
  used_images_this_period: number | string | null;
  total_payments: number | string | null;
  paid_payments: number | string | null;
  pending_payments: number | string | null;
  total_paid_thb: number | string | null;
};

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function toAdminUser(row: AdminUserRow): AdminUserListItem {
  const monthlyImageLimit = toNumber(row.monthly_image_limit);
  const usedImagesThisPeriod = toNumber(row.used_images_this_period);
  const adminPeriodStart = new Date();
  const adminPeriodEnd = new Date(adminPeriodStart);
  adminPeriodEnd.setFullYear(adminPeriodEnd.getFullYear() + 1);

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    subscription: row.subscription_id
      ? {
          id: row.subscription_id,
          status: row.subscription_status || "unknown",
          currentPeriodStart:
            row.current_period_start?.toISOString() || "",
          currentPeriodEnd: row.current_period_end?.toISOString() || "",
          planSlug: row.plan_slug || "",
          planName: row.plan_name || "Unknown",
          priceMonthlyThb: toNumber(row.price_monthly_thb),
          monthlyImageLimit,
          usedImagesThisPeriod,
          remainingImages: Math.max(0, monthlyImageLimit - usedImagesThisPeriod),
        }
      : row.role === "admin"
        ? {
            id: "admin",
            status: "active",
            currentPeriodStart: adminPeriodStart.toISOString(),
            currentPeriodEnd: adminPeriodEnd.toISOString(),
            planSlug: ADMIN_SUBSCRIPTION_PLAN.slug,
            planName: ADMIN_SUBSCRIPTION_PLAN.name,
            priceMonthlyThb: ADMIN_SUBSCRIPTION_PLAN.priceMonthlyThb,
            monthlyImageLimit: ADMIN_SUBSCRIPTION_PLAN.monthlyImageLimit,
            usedImagesThisPeriod: 0,
            remainingImages: ADMIN_SUBSCRIPTION_PLAN.monthlyImageLimit,
          }
        : null,
    paymentSummary: {
      totalPayments: toNumber(row.total_payments),
      paidPayments: toNumber(row.paid_payments),
      pendingPayments: toNumber(row.pending_payments),
      totalPaidThb: toNumber(row.total_paid_thb),
    },
  };
}

export async function listAdminUsers({
  search = "",
  limit = 100,
}: {
  search?: string;
  limit?: number;
} = {}) {
  const db = getDb();
  const trimmedSearch = search.trim().toLowerCase();
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  const rows = await db<AdminUserRow[]>`
    select
      u.id,
      u.email,
      u.display_name,
      u.role,
      u.created_at,
      u.updated_at,
      active_subscription.id as subscription_id,
      active_subscription.status as subscription_status,
      active_subscription.current_period_start,
      active_subscription.current_period_end,
      active_subscription.plan_slug,
      active_subscription.plan_name,
      active_subscription.price_monthly_thb,
      active_subscription.monthly_image_limit,
      coalesce(period_usage.used_images_this_period, 0) as used_images_this_period,
      coalesce(payment_summary.total_payments, 0) as total_payments,
      coalesce(payment_summary.paid_payments, 0) as paid_payments,
      coalesce(payment_summary.pending_payments, 0) as pending_payments,
      coalesce(payment_summary.total_paid_thb, 0) as total_paid_thb
    from users u
    left join lateral (
      select
        s.id,
        s.status,
        s.current_period_start,
        s.current_period_end,
        s.plan_slug_snapshot as plan_slug,
        s.plan_name_snapshot as plan_name,
        s.price_monthly_thb_snapshot as price_monthly_thb,
        s.monthly_image_limit_snapshot as monthly_image_limit
      from subscriptions s
      where s.user_id = u.id
      order by
        case when s.status = 'active' then 0 else 1 end,
        s.current_period_end desc
      limit 1
    ) active_subscription on true
    left join lateral (
      select coalesce(sum(ue.image_count), 0) as used_images_this_period
      from usage_events ue
      where ue.user_id = u.id
        and active_subscription.id is not null
        and ue.created_at >= active_subscription.current_period_start
        and ue.created_at < active_subscription.current_period_end
    ) period_usage on true
    left join lateral (
      select
        count(*) as total_payments,
        count(*) filter (where status = 'paid') as paid_payments,
        count(*) filter (where status = 'pending') as pending_payments,
        coalesce(sum(amount_thb) filter (where status = 'paid'), 0) as total_paid_thb
      from payments pay
      where pay.user_id = u.id
    ) payment_summary on true
    where
      ${trimmedSearch} = ''
      or lower(u.email) like ${`%${trimmedSearch}%`}
      or lower(coalesce(u.display_name, '')) like ${`%${trimmedSearch}%`}
    order by u.created_at desc
    limit ${safeLimit}
  `;

  return rows.map(toAdminUser);
}

export async function updateUserRole({
  adminUserId,
  userId,
  role,
}: {
  adminUserId: string;
  userId: string;
  role: AdminUserRole;
}) {
  const db = getDb();

  return db.begin(async (sql) => {
    const [updated] = await sql<{
      id: string;
      email: string;
      display_name: string | null;
      role: AdminUserRole;
      created_at: Date;
      updated_at: Date;
    }[]>`
      update users
      set role = ${role},
          updated_at = now()
      where id = ${userId}::uuid
      returning id, email, display_name, role, created_at, updated_at
    `;

    if (!updated) return null;

    await sql`
      insert into admin_actions (
        admin_user_id,
        action,
        target_type,
        target_id,
        metadata
      )
      values (
        ${adminUserId}::uuid,
        'update_user_role',
        'user',
        ${userId}::uuid,
        jsonb_build_object('role', ${role}::text)
      )
    `;

    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.display_name,
      role: updated.role,
      createdAt: updated.created_at.toISOString(),
      updatedAt: updated.updated_at.toISOString(),
    };
  });
}
