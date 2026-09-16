import process from "node:process";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL. Set it before running db:check:subscription:phase2.");
}

const db = postgres(databaseUrl, { max: 1, prepare: false });

try {
  const [columns] = await db`
    select
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'payments' and column_name = 'expires_at'
      ) as has_payment_expiry,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'payment_proofs' and column_name = 'blob_pathname'
      ) as has_private_proof_metadata
  `;

  if (!columns.has_payment_expiry) {
    const [preflight] = await db`
      select
        count(*) filter (where status = 'pending')::integer as pending_payments,
        count(*) filter (
          where status = 'pending' and created_at + interval '24 hours' <= now()
        )::integer as pending_that_will_expire
      from payments
    `;
    console.table([{ migration_applied: false, ...preflight }]);
  } else {
    const [summary] = await db`
      select
        count(*) filter (where status = 'pending')::integer as pending_payments,
        count(*) filter (where status = 'expired')::integer as expired_payments,
        count(*) filter (
          where status = 'pending' and expires_at <= now()
        )::integer as stale_pending_payments
      from payments
    `;
    const [proofs] = await db`
      select
        count(*)::integer as proofs,
        count(*) filter (
          where storage_provider = 'vercel_blob_private'
            and blob_pathname is not null
            and content_type is not null
            and size_bytes is not null
        )::integer as private_blob_proofs
      from payment_proofs
    `;
    console.table([{
      migration_applied: true,
      private_metadata: columns.has_private_proof_metadata,
      ...summary,
      ...proofs,
    }]);
  }
} finally {
  await db.end({ timeout: 5 });
}
