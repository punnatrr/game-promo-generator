import { getDb } from "@/lib/db";
import { getPaymentPendingHours, type ManualPaymentMethod } from "./config";

export type PaymentStatus = "pending" | "paid" | "rejected" | "refunded" | "expired";

export type UserPayment = {
  id: string;
  userId: string;
  planSlug: string;
  planName: string;
  amountThb: number;
  currency: string;
  method: ManualPaymentMethod | "card";
  status: PaymentStatus;
  createdAt: Date;
  expiresAt: Date;
  paidAt: Date | null;
  hasProof: boolean;
  proofStatus: "pending" | "approved" | "rejected" | null;
};

export type AdminPayment = UserPayment & {
  userEmail: string;
  proofNote: string | null;
};

type PaymentRow = {
  id: string;
  user_id: string;
  plan_slug: string;
  plan_name: string;
  amount_thb: number;
  currency: string;
  method: ManualPaymentMethod | "card";
  status: PaymentStatus;
  created_at: Date;
  expires_at: Date;
  paid_at: Date | null;
  has_proof?: boolean;
  proof_status?: "pending" | "approved" | "rejected" | null;
};

type AdminPaymentRow = PaymentRow & {
  user_email: string;
  proof_note: string | null;
};

function toPayment(row: PaymentRow): UserPayment {
  return {
    id: row.id,
    userId: row.user_id,
    planSlug: row.plan_slug,
    planName: row.plan_name,
    amountThb: row.amount_thb,
    currency: row.currency,
    method: row.method,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    hasProof: row.has_proof ?? false,
    proofStatus: row.proof_status ?? null,
  };
}

function toAdminPayment(row: AdminPaymentRow): AdminPayment {
  return {
    ...toPayment(row),
    userEmail: row.user_email,
    proofNote: row.proof_note,
  };
}

export async function createManualPaymentRequest({
  userId,
  planSlug,
  method,
  idempotencyKey,
}: {
  userId: string;
  planSlug: string;
  method: ManualPaymentMethod;
  idempotencyKey: string;
}) {
  const db = getDb();
  const pendingHours = getPaymentPendingHours();

  return db.begin(async (sql) => {
    await sql`
      select pg_advisory_xact_lock(
        hashtextextended(${`manual-payment:${userId}`}, 0)
      )
    `;

    await sql`
      update payments
      set status = 'expired', updated_at = now()
      where user_id = ${userId}
        and status = 'pending'
        and expires_at <= now()
    `;

    const [existingByKey] = await sql<PaymentRow[]>`
      select
        id,
        user_id,
        plan_slug_snapshot as plan_slug,
        plan_name_snapshot as plan_name,
        amount_thb,
        currency,
        method,
        status,
        created_at,
        expires_at,
        paid_at
      from payments
      where user_id = ${userId}
        and request_idempotency_key = ${idempotencyKey}
      limit 1
    `;

    if (existingByKey) return toPayment(existingByKey);

    const [existingPending] = await sql<PaymentRow[]>`
      select
        payment.id,
        payment.user_id,
        payment.plan_slug_snapshot as plan_slug,
        payment.plan_name_snapshot as plan_name,
        payment.amount_thb,
        payment.currency,
        payment.method,
        payment.status,
        payment.created_at,
        payment.expires_at,
        payment.paid_at
      from payments payment
      join plans plan on plan.id = payment.plan_id
      where payment.user_id = ${userId}
        and plan.slug = ${planSlug}
        and payment.status = 'pending'
      order by payment.created_at desc
      limit 1
    `;

    if (existingPending) return toPayment(existingPending);

    const [row] = await sql<PaymentRow[]>`
      insert into payments (
        user_id,
        plan_id,
        amount_thb,
        currency,
        method,
        status,
        provider,
        plan_slug_snapshot,
        plan_name_snapshot,
        plan_description_snapshot,
        price_monthly_thb_snapshot,
        monthly_image_limit_snapshot,
        has_special_features_snapshot,
        has_vip_support_snapshot,
        history_retention_days_snapshot,
        max_images_per_generation_snapshot,
        request_idempotency_key,
        expires_at
      )
      select
        ${userId},
        plan.id,
        plan.price_monthly_thb,
        'THB',
        ${method},
        'pending',
        'manual',
        plan.slug,
        plan.name,
        coalesce(plan.description, ''),
        plan.price_monthly_thb,
        plan.monthly_image_limit,
        plan.has_special_features,
        plan.has_vip_support,
        plan.history_retention_days,
        plan.max_images_per_generation,
        ${idempotencyKey},
        now() + (${pendingHours} * interval '1 hour')
      from plans plan
      where plan.slug = ${planSlug}
        and plan.is_active = true
      returning
        id,
        user_id,
        plan_slug_snapshot as plan_slug,
        plan_name_snapshot as plan_name,
        amount_thb,
        currency,
        method,
        status,
        created_at,
        expires_at,
        paid_at
    `;

    return row ? toPayment(row) : null;
  });
}

export async function listUserPayments(userId: string) {
  const db = getDb();

  await db`
    update payments
    set status = 'expired', updated_at = now()
    where user_id = ${userId}
      and status = 'pending'
      and expires_at <= now()
  `;

  const rows = await db<PaymentRow[]>`
    select
      pay.id,
      pay.user_id,
      pay.plan_slug_snapshot as plan_slug,
      pay.plan_name_snapshot as plan_name,
      pay.amount_thb,
      pay.currency,
      pay.method,
      pay.status,
      pay.created_at,
      pay.expires_at,
      pay.paid_at,
      (proof.id is not null) as has_proof,
      proof.review_status as proof_status
    from payments pay
    left join lateral (
      select id, review_status
      from payment_proofs
      where payment_id = pay.id
      order by created_at desc
      limit 1
    ) proof on true
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

  await db`
    update payments
    set status = 'expired', updated_at = now()
    where id = ${paymentId}
      and user_id = ${userId}
      and status = 'pending'
      and expires_at <= now()
  `;

  const [row] = await db<{
    id: string;
    status: PaymentStatus;
    expires_at: Date;
    amountThb: number;
    method: ManualPaymentMethod | "card";
  }[]>`
    select id, status, expires_at, amount_thb as "amountThb", method
    from payments
    where id = ${paymentId}
      and user_id = ${userId}
    limit 1
  `;

  return row ?? null;
}

export async function savePaymentProof({
  userId,
  paymentId,
  proofImageUrl,
  blobPathname,
  contentType,
  sizeBytes,
  originalFilename,
  note,
}: {
  userId: string;
  paymentId: string;
  proofImageUrl: string;
  blobPathname: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  originalFilename: string;
  note?: string;
}) {
  const db = getDb();

  return db.begin(async (sql) => {
    const [payment] = await sql<{ id: string; status: PaymentStatus; expires_at: Date }[]>`
      select id, status, expires_at
      from payments
      where id = ${paymentId}
        and user_id = ${userId}
      for update
    `;

    if (!payment) return { outcome: "not_found" as const };
    if (payment.status !== "pending" || payment.expires_at <= new Date()) {
      if (payment.status === "pending") {
        await sql`
          update payments
          set status = 'expired', updated_at = now()
          where id = ${paymentId}
        `;
      }
      return { outcome: "not_pending" as const };
    }

    const [previous] = await sql<{ proof_image_url: string }[]>`
      select proof_image_url
      from payment_proofs
      where payment_id = ${paymentId}
        and review_status = 'pending'
      limit 1
    `;

    const [row] = await sql<{ id: string }[]>`
      insert into payment_proofs (
        payment_id,
        uploaded_by_user_id,
        proof_image_url,
        storage_provider,
        blob_pathname,
        content_type,
        size_bytes,
        original_filename,
        note
      )
      values (
        ${paymentId},
        ${userId},
        ${proofImageUrl},
        'vercel_blob_private',
        ${blobPathname},
        ${contentType},
        ${sizeBytes},
        ${originalFilename},
        ${note || null}
      )
      on conflict (payment_id) where review_status = 'pending'
      do update set
        uploaded_by_user_id = excluded.uploaded_by_user_id,
        proof_image_url = excluded.proof_image_url,
        storage_provider = excluded.storage_provider,
        blob_pathname = excluded.blob_pathname,
        content_type = excluded.content_type,
        size_bytes = excluded.size_bytes,
        original_filename = excluded.original_filename,
        note = excluded.note,
        created_at = now(),
        updated_at = now()
      returning id
    `;

    return {
      outcome: "saved" as const,
      proofId: row.id,
      previousProofImageUrl: previous?.proof_image_url ?? null,
    };
  });
}

export async function getPaymentProofForViewer({
  paymentId,
  userId,
  isAdmin,
}: {
  paymentId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const db = getDb();
  const [row] = await db<{
    proof_image_url: string;
    content_type: string | null;
    original_filename: string | null;
  }[]>`
    select proof.proof_image_url, proof.content_type, proof.original_filename
    from payments payment
    join lateral (
      select proof_image_url, content_type, original_filename
      from payment_proofs
      where payment_id = payment.id
      order by created_at desc
      limit 1
    ) proof on true
    where payment.id = ${paymentId}
      and (${isAdmin} or payment.user_id = ${userId})
    limit 1
  `;
  return row ?? null;
}

export async function listAdminPayments({
  status = "pending",
}: {
  status?: PaymentStatus;
} = {}) {
  const db = getDb();

  await db`
    update payments
    set status = 'expired', updated_at = now()
    where status = 'pending'
      and expires_at <= now()
  `;

  const rows = await db<AdminPaymentRow[]>`
    select
      pay.id,
      pay.user_id,
      u.email as user_email,
      pay.plan_slug_snapshot as plan_slug,
      pay.plan_name_snapshot as plan_name,
      pay.amount_thb,
      pay.currency,
      pay.method,
      pay.status,
      pay.created_at,
      pay.expires_at,
      pay.paid_at,
      (proof.id is not null) as has_proof,
      proof.note as proof_note,
      proof.review_status as proof_status
    from payments pay
    join users u on u.id = pay.user_id
    left join lateral (
      select id, note, review_status
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
  idempotencyKey,
}: {
  paymentId: string;
  adminUserId: string;
  idempotencyKey: string;
}) {
  const db = getDb();

  return db.begin(async (sql) => {
    const [payment] = await sql<{
      id: string;
      user_id: string;
      plan_id: string;
      method: string;
      status: PaymentStatus;
      subscription_id: string | null;
      currency: string;
      plan_slug_snapshot: string;
      plan_name_snapshot: string;
      plan_description_snapshot: string;
      price_monthly_thb_snapshot: number;
      monthly_image_limit_snapshot: number;
      has_special_features_snapshot: boolean;
      has_vip_support_snapshot: boolean;
      history_retention_days_snapshot: number;
      max_images_per_generation_snapshot: number;
      expires_at: Date;
    }[]>`
      select
        id,
        user_id,
        plan_id,
        method,
        status,
        subscription_id,
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
        ,expires_at
      from payments
      where id = ${paymentId}
      for update
    `;

    if (!payment) return null;

    if (payment.status === "paid" && payment.subscription_id) {
      return {
        paymentId: payment.id,
        subscriptionId: payment.subscription_id,
        alreadyProcessed: true,
      };
    }

    if (payment.status !== "pending") return null;

    if (payment.expires_at <= new Date()) {
      await sql`
        update payments
        set status = 'expired', updated_at = now()
        where id = ${payment.id}
      `;
      return null;
    }

    const [pendingProof] = await sql<{ id: string }[]>`
      select id
      from payment_proofs
      where payment_id = ${payment.id}
        and review_status = 'pending'
        and storage_provider = 'vercel_blob_private'
      limit 1
      for update
    `;
    if (!pendingProof) return null;

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
      values (
        ${payment.user_id},
        ${payment.plan_id},
        'active',
        ${payment.method},
        now(),
        now() + interval '30 days',
        ${payment.currency},
        ${payment.plan_slug_snapshot},
        ${payment.plan_name_snapshot},
        ${payment.plan_description_snapshot},
        ${payment.price_monthly_thb_snapshot},
        ${payment.monthly_image_limit_snapshot},
        ${payment.has_special_features_snapshot},
        ${payment.has_vip_support_snapshot},
        ${payment.history_retention_days_snapshot},
        ${payment.max_images_per_generation_snapshot}
      )
      returning id
    `;

    await sql`
      update payments
      set status = 'paid',
          paid_at = now(),
          subscription_id = ${subscription.id},
          decision_idempotency_key = ${idempotencyKey},
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
        jsonb_build_object(
          'subscription_id', ${subscription.id}::text,
          'idempotency_key', ${idempotencyKey}::text
        )
      )
    `;

    return {
      paymentId: payment.id,
      subscriptionId: subscription.id,
      alreadyProcessed: false,
    };
  });
}

export async function rejectPayment({
  paymentId,
  adminUserId,
  reason,
  idempotencyKey,
}: {
  paymentId: string;
  adminUserId: string;
  reason?: string;
  idempotencyKey: string;
}) {
  const db = getDb();

  return db.begin(async (sql) => {
    const [payment] = await sql<{
      id: string;
      user_id: string;
      status: PaymentStatus;
      expires_at: Date;
    }[]>`
      select id, user_id, status, expires_at
      from payments
      where id = ${paymentId}
      for update
    `;

    if (!payment) return null;

    if (payment.status === "rejected") {
      return {
        paymentId: payment.id,
        alreadyProcessed: true,
      };
    }

    if (payment.status !== "pending") return null;

    if (payment.expires_at <= new Date()) {
      await sql`
        update payments
        set status = 'expired', updated_at = now()
        where id = ${payment.id}
      `;
      return null;
    }

    await sql`
      update payments
      set status = 'rejected',
          decision_idempotency_key = ${idempotencyKey},
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
        jsonb_build_object(
          'reason', ${reason || ''}::text,
          'idempotency_key', ${idempotencyKey}::text
        )
      )
    `;

    return {
      paymentId: payment.id,
      alreadyProcessed: false,
    };
  });
}
