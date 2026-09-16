import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL");
}

const db = postgres(databaseUrl, {
  max: 1,
  prepare: false,
});

try {
  const [status] = await db`
    select
      exists (
        select 1
        from schema_migrations
        where file_name = '20260824_trial_codes.sql'
      ) as migration_applied,
      to_regclass('public.promo_codes') is not null as promo_codes_exists,
      exists (
        select 1
        from plans
        where slug = 'trial'
          and monthly_image_limit = 10
          and is_active = false
      ) as trial_plan_exists,
      exists (
        select 1
        from promo_codes
        where code_hash = encode(digest('LAZYFREE10', 'sha256'), 'hex')
          and is_active = true
      ) as starter_code_exists
  `;

  console.log(JSON.stringify(status));
} finally {
  await db.end({ timeout: 5 });
}
