-- Subscription Phase 1: immutable plan snapshots, idempotency, and invariants.

update plans
set description = case slug
  when 'basic' then '15 รูปต่อเดือน สำหรับเริ่มใช้งาน'
  when 'pro' then '30 รูปต่อเดือน พร้อมฟีเจอร์พิเศษ'
  when 'business' then '100 รูปต่อเดือน พร้อมฟีเจอร์พิเศษและบริการ VIP'
  else description
end,
updated_at = now()
where
  (slug = 'basic' and description = '15 images per month. No special features.')
  or (slug = 'pro' and description = '30 images per month. Includes special features.')
  or (
    slug = 'business'
    and description = '100 images per month. Includes special features and VIP service.'
  );

alter table payments
  add column if not exists currency text not null default 'THB',
  add column if not exists plan_slug_snapshot text,
  add column if not exists plan_name_snapshot text,
  add column if not exists plan_description_snapshot text,
  add column if not exists price_monthly_thb_snapshot integer,
  add column if not exists monthly_image_limit_snapshot integer,
  add column if not exists has_special_features_snapshot boolean,
  add column if not exists has_vip_support_snapshot boolean,
  add column if not exists history_retention_days_snapshot integer,
  add column if not exists max_images_per_generation_snapshot integer,
  add column if not exists request_idempotency_key text,
  add column if not exists decision_idempotency_key text;

update payments payment
set
  plan_slug_snapshot = coalesce(payment.plan_slug_snapshot, plan.slug),
  plan_name_snapshot = coalesce(payment.plan_name_snapshot, plan.name),
  plan_description_snapshot = coalesce(payment.plan_description_snapshot, plan.description, ''),
  price_monthly_thb_snapshot = coalesce(payment.price_monthly_thb_snapshot, payment.amount_thb, plan.price_monthly_thb),
  monthly_image_limit_snapshot = coalesce(payment.monthly_image_limit_snapshot, plan.monthly_image_limit),
  has_special_features_snapshot = coalesce(payment.has_special_features_snapshot, plan.has_special_features),
  has_vip_support_snapshot = coalesce(payment.has_vip_support_snapshot, plan.has_vip_support),
  history_retention_days_snapshot = coalesce(payment.history_retention_days_snapshot, plan.history_retention_days),
  max_images_per_generation_snapshot = coalesce(payment.max_images_per_generation_snapshot, plan.max_images_per_generation)
from plans plan
where payment.plan_id = plan.id;

alter table payments
  alter column plan_slug_snapshot set not null,
  alter column plan_name_snapshot set not null,
  alter column plan_description_snapshot set not null,
  alter column price_monthly_thb_snapshot set not null,
  alter column monthly_image_limit_snapshot set not null,
  alter column has_special_features_snapshot set not null,
  alter column has_vip_support_snapshot set not null,
  alter column history_retention_days_snapshot set not null,
  alter column max_images_per_generation_snapshot set not null;

alter table subscriptions
  add column if not exists currency text not null default 'THB',
  add column if not exists plan_slug_snapshot text,
  add column if not exists plan_name_snapshot text,
  add column if not exists plan_description_snapshot text,
  add column if not exists price_monthly_thb_snapshot integer,
  add column if not exists monthly_image_limit_snapshot integer,
  add column if not exists has_special_features_snapshot boolean,
  add column if not exists has_vip_support_snapshot boolean,
  add column if not exists history_retention_days_snapshot integer,
  add column if not exists max_images_per_generation_snapshot integer;

update subscriptions subscription
set
  plan_slug_snapshot = coalesce(subscription.plan_slug_snapshot, plan.slug),
  plan_name_snapshot = coalesce(subscription.plan_name_snapshot, plan.name),
  plan_description_snapshot = coalesce(subscription.plan_description_snapshot, plan.description, ''),
  price_monthly_thb_snapshot = coalesce(subscription.price_monthly_thb_snapshot, plan.price_monthly_thb),
  monthly_image_limit_snapshot = coalesce(subscription.monthly_image_limit_snapshot, plan.monthly_image_limit),
  has_special_features_snapshot = coalesce(subscription.has_special_features_snapshot, plan.has_special_features),
  has_vip_support_snapshot = coalesce(subscription.has_vip_support_snapshot, plan.has_vip_support),
  history_retention_days_snapshot = coalesce(subscription.history_retention_days_snapshot, plan.history_retention_days),
  max_images_per_generation_snapshot = coalesce(subscription.max_images_per_generation_snapshot, plan.max_images_per_generation)
from plans plan
where subscription.plan_id = plan.id;

alter table subscriptions
  alter column plan_slug_snapshot set not null,
  alter column plan_name_snapshot set not null,
  alter column plan_description_snapshot set not null,
  alter column price_monthly_thb_snapshot set not null,
  alter column monthly_image_limit_snapshot set not null,
  alter column has_special_features_snapshot set not null,
  alter column has_vip_support_snapshot set not null,
  alter column history_retention_days_snapshot set not null,
  alter column max_images_per_generation_snapshot set not null;

-- Bring legacy data in line before adding unique partial indexes.
update subscriptions
set status = 'expired', updated_at = now()
where status = 'active'
  and current_period_end <= now();

with duplicate_active_subscriptions as (
  select id
  from (
    select
      id,
      row_number() over (
        partition by user_id
        order by current_period_end desc, created_at desc, id desc
      ) as row_number
    from subscriptions
    where status = 'active'
  ) ranked
  where row_number > 1
)
update subscriptions subscription
set
  status = 'canceled',
  canceled_at = coalesce(subscription.canceled_at, now()),
  updated_at = now()
where subscription.id in (select id from duplicate_active_subscriptions);

with duplicate_pending_payments as (
  select id
  from (
    select
      id,
      row_number() over (
        partition by user_id, plan_id
        order by created_at desc, id desc
      ) as row_number
    from payments
    where status = 'pending'
  ) ranked
  where row_number > 1
)
update payments
set status = 'expired', updated_at = now()
where id in (select id from duplicate_pending_payments);

with duplicate_pending_proofs as (
  select id
  from (
    select
      id,
      row_number() over (
        partition by payment_id
        order by created_at desc, id desc
      ) as row_number
    from payment_proofs
    where review_status = 'pending'
  ) ranked
  where row_number > 1
)
update payment_proofs
set review_status = 'rejected', reviewed_at = coalesce(reviewed_at, now())
where id in (select id from duplicate_pending_proofs);

create unique index if not exists subscriptions_one_active_per_user_uidx
  on subscriptions(user_id)
  where status = 'active';

create unique index if not exists subscriptions_provider_subscription_uidx
  on subscriptions(provider_subscription_id)
  where provider_subscription_id is not null;

create unique index if not exists payments_one_pending_per_user_plan_uidx
  on payments(user_id, plan_id)
  where status = 'pending';

create unique index if not exists payments_provider_payment_uidx
  on payments(provider, provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists payments_user_request_idempotency_uidx
  on payments(user_id, request_idempotency_key)
  where request_idempotency_key is not null;

create unique index if not exists payments_decision_idempotency_uidx
  on payments(decision_idempotency_key)
  where decision_idempotency_key is not null;

create unique index if not exists payment_proofs_one_pending_per_payment_uidx
  on payment_proofs(payment_id)
  where review_status = 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_currency_check'
  ) then
    alter table payments
      add constraint payments_currency_check
      check (currency ~ '^[A-Z]{3}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_currency_check'
  ) then
    alter table subscriptions
      add constraint subscriptions_currency_check
      check (currency ~ '^[A-Z]{3}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'payments_request_idempotency_key_check'
  ) then
    alter table payments
      add constraint payments_request_idempotency_key_check
      check (
        request_idempotency_key is null
        or char_length(request_idempotency_key) between 8 and 128
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'payments_decision_idempotency_key_check'
  ) then
    alter table payments
      add constraint payments_decision_idempotency_key_check
      check (
        decision_idempotency_key is null
        or char_length(decision_idempotency_key) between 8 and 128
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'payments_snapshot_values_check'
  ) then
    alter table payments
      add constraint payments_snapshot_values_check
      check (
        price_monthly_thb_snapshot >= 0
        and monthly_image_limit_snapshot >= 0
        and history_retention_days_snapshot > 0
        and max_images_per_generation_snapshot > 0
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_snapshot_values_check'
  ) then
    alter table subscriptions
      add constraint subscriptions_snapshot_values_check
      check (
        price_monthly_thb_snapshot >= 0
        and monthly_image_limit_snapshot >= 0
        and history_retention_days_snapshot > 0
        and max_images_per_generation_snapshot > 0
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_period_check'
  ) then
    alter table subscriptions
      add constraint subscriptions_period_check
      check (current_period_end > current_period_start);
  end if;
end $$;
