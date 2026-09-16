import { getDb } from "@/lib/db";
import type { ManualPaymentMethod } from "./config";

export type PaymentStatus = "pending" | "paid" | "rejected" | "refunded" | "expired";

export type UserPayment = {
  id: string;
  userId: string;
  planSlug: string;
  planName: string;
  amountThb: number;
  method: ManualPaymentMethod | "card";
  status: PaymentStatus;
  createdAt: Date;
  paidAt: Date | null;
};

export type AdminPayment = UserPayment & {
  userEmail: string;
  proofImageUrl: string | null;
  proofNote: string | null;
  proofStatus: string | null;
};

type PaymentRow = {
  id: string;
  user_id: string;
  plan_slug: string;
  plan_name: string;
  amount_thb: number;
  method: ManualPaymentMethod | "card";
  status: PaymentStatus;
  created_at: Date;
  paid_at: Date | null;
};

type AdminPaymentRow = PaymentRow & {
  user_email: string;
  proof_image_url: string | null;
  proof_note: string | null;
  proof_status: string | null;
};

function toPayment(row: PaymentRow): UserPayment {
  return {
    id: row.id,
    userId: row.user_id,
    planSlug: row.plan_slug,
    planName: row.plan_name,
    amountThb: row.amount_thb,
    method: row.method,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

function toAdminPayment(row: AdminPaymentRow): AdminPayment {
  return {
    ...toPayment(row),
    userEmail: row.user_email,
    proofImageUrl: row.proof_image_url,
    proofNote: row.proof_note,
    proofStatus: row.proof_status,
  };
}

export async function createManualPaymentRequest({
  userId,
  planSlug,
  method,
}: {
  userId: string;
  planSlug: string;
  method: ManualPaymentMethod;
}) {
  const db = getDb();
  const [row] = await db<PaymentRow[]>`
    insert into payments (
      user_id,
      plan_id,
      amount_thb,
      method,
      status,
      provider
    )
    select
      ${userId},
      p.id,
      p.price_monthly_thb,
      ${method},
      'pending',
      'manual'
    from plans p
    where p.slug = ${planSlug}
      and p.is_active = true
    returning
      id,
      user_id,
      (select slug from plans where id = payments.plan_id) as plan_slug,
      (select name from plans where id = payments.plan_id) as plan_name,
      amount_thb,
      method,
      status,
      created_at,
      paid_at
  `;

  return row ? toPayment(row) : null;
}

export async function listUserPayments(userId: string) {
  const db = getDb();
  const rows = await db<PaymentRow[]>`
    select
      pay.id,
      pay.user_id,
      p.slug as plan_slug,
      p.name as plan_name,
      pay.amount_thb,
      pay.method,
      pay.status,
      pay.created_at,
      pay.paid_at
    from payments pay
    join plans p on p.id = pay.plan_id
    where pay.user_id = ${userId}
    order by pay.created_at desc
    limit 20
  `;

  return rows.map(toPayment);
}

export async function assertUserOwnsPayment({
  userId,
  paymentId,
}: {
  userId: string;
  paymentId: string;
}) {
  const db = getDb();
  const [row] = await db<{ id: string; status: PaymentStatus }[]>`
    select id, status
    from payments
    where id = ${paymentId}
      and user_id = ${userId}
    limit 1
  `;

  return row ?? null;
}

export async function createPaymentProof({
  userId,
  paymentId,
  proofImageUrl,
  note,
}: {
  userId: string;
  paymentId: string;
  proofImageUrl: string;
  note?: string;
}) {
  const db = getDb();
  const [row] = await db<{ id: string }[]>`
    insert into payment_proofs (
      payment_id,
      uploaded_by_user_id,
      proof_image_url,
      note
    )
    values (${paymentId}, ${userId}, ${proofImageUrl}, ${note || null})
    returning id
  `;

  return row;
}

export async function listAdminPayments({
  status = "pending",
}: {
  status?: PaymentStatus;
} = {}) {
  const db = getDb();
  const rows = await db<AdminPaymentRow[]>`
    select
      pay.id,
      pay.user_id,
      u.email as user_email,
      p.slug as plan_slug,
      p.name as plan_name,
      pay.amount_thb,
      pay.method,
      pay.status,
      pay.created_at,
      pay.paid_at,
      proof.proof_image_url,
      proof.note as proof_note,
      proof.review_status as proof_status
    from payments pay
    join users u on u.id = pay.user_id
    join plans p on p.id = pay.plan_id
    left join lateral (
      select proof_image_url, note, review_status
      from payment_proofs
      where payment_id = pay.id
      order by created_at desc
      limit 1
    ) proof on true
    where pay.status = ${status}
    order by pay.created_at asc
    limit 100
  `;

  return rows.map(toAdminPayment);
}

export async function approvePayment({
  paymentId,
  adminUserId,
}: {
  paymentId: string;
  adminUserId: string;
}) {
  const db = getDb();

  return db.begin(async (sql) => {
    const [payment] = await sql<{
      id: string;
      user_id: string;
      plan_id: string;
      method: string;
    }[]>`
      select id, user_id, plan_id, method
      from payments
      where id = ${paymentId}
        and status = 'pending'
      for update
    `;

    if (!payment) return null;

    await sql`
      update subscriptions
      set status = 'canceled',
          canceled_at = now(),
          updated_at = now()
      where user_id = ${payment.user_id}
        and status = 'active'
    `;

    const [subscription] = await sql<{ id: string }[]>`
      insert into subscriptions (
        user_id,
        plan_id,
        status,
        payment_method,
        current_period_start,
        current_period_end
      )
      values (
        ${payment.user_id},
        ${payment.plan_id},
        'active',
        ${payment.method},
        now(),
        now() + interval '30 days'
      )
      returning id
    `;

    await sql`
      update payments
      set status = 'paid',
          paid_at = now(),
          subscription_id = ${subscription.id},
          updated_at = now()
      where id = ${payment.id}
    `;

    await sql`
      update payment_proofs
      set review_status = 'approved',
          reviewed_by_user_id = ${adminUserId},
          reviewed_at = now()
      where payment_id = ${payment.id}
    `;

    await sql`
      insert into notifications (user_id, type, title, message)
      values (
        ${payment.user_id},
        'payment_approved',
        'Payment approved',
        'Your subscription is active for 30 days.'
      )
    `;

    await sql`
      insert into admin_actions (
        admin_user_id,
        action,
        target_type,
        target_id,
        metadata
      )
      values (
        ${adminUserId},
        'approve_payment',
        'payment',
        ${payment.id},
        jsonb_build_object('subscription_id', ${subscription.id})
      )
    `;

    return {
      paymentId: payment.id,
      subscriptionId: subscription.id,
    };
  });
}

export async function rejectPayment({
  paymentId,
  adminUserId,
  reason,
}: {
  paymentId: string;
  adminUserId: string;
  reason?: string;
}) {
  const db = getDb();

  return db.begin(async (sql) => {
    const [payment] = await sql<{ id: string; user_id: string }[]>`
      select id, user_id
      from payments
      where id = ${paymentId}
        and status = 'pending'
      for update
    `;

    if (!payment) return null;

    await sql`
      update payments
      set status = 'rejected',
          updated_at = now()
      where id = ${payment.id}
    `;

    await sql`
      update payment_proofs
      set review_status = 'rejected',
          reviewed_by_user_id = ${adminUserId},
          reviewed_at = now()
      where payment_id = ${payment.id}
    `;

    await sql`
      insert into notifications (user_id, type, title, message)
      values (
        ${payment.user_id},
        'payment_rejected',
        'Payment rejected',
        ${reason || 'Your payment proof was rejected. Please contact support.'}
      )
    `;

    await sql`
      insert into admin_actions (
        admin_user_id,
        action,
        target_type,
        target_id,
        metadata
      )
      values (
        ${adminUserId},
        'reject_payment',
        'payment',
        ${payment.id},
        jsonb_build_object('reason', ${reason || ''})
      )
    `;

    return {
      paymentId: payment.id,
    };
  });
}
