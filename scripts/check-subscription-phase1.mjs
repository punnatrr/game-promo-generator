import process from "node:process";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "Missing DATABASE_URL. Set it before running db:check:subscription."
  );
}

const db = postgres(databaseUrl, {
  max: 1,
  prepare: false,
});

try {
  const [summary] = await db`
    select
      (select count(*)::integer from subscriptions) as subscriptions,
      (select count(*)::integer from payments) as payments,
      (
        select count(*)::integer from payments where status = 'pending'
      ) as pending_payments,
      (
        select count(*)::integer from payments where status = 'expired'
      ) as expired_payments,
      (
        select count(*)::integer
        from subscriptions
        where status = 'active' and current_period_end <= now()
      ) as expired_active_subscriptions,
      (
        select count(*)::integer
        from (
          select user_id
          from subscriptions
          where status = 'active'
          group by user_id
          having count(*) > 1
        ) duplicate_users
      ) as users_with_multiple_active_subscriptions,
      (
        select count(*)::integer
        from (
          select user_id, plan_id
          from payments
          where status = 'pending'
          group by user_id, plan_id
          having count(*) > 1
        ) duplicate_payments
      ) as duplicate_pending_payment_groups,
      (
        select count(*)::integer
        from (
          select payment_id
          from payment_proofs
          where review_status = 'pending'
          group by payment_id
          having count(*) > 1
        ) duplicate_proofs
      ) as duplicate_pending_proof_groups
  `;

  console.table([summary]);
} finally {
  await db.end({ timeout: 5 });
}
