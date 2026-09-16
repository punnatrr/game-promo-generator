-- Redeemable free-trial codes. Each user can claim one trial entitlement.

insert into plans (
  slug,
  name,
  description,
  price_monthly_thb,
  monthly_image_limit,
  has_special_features,
  has_vip_support,
  history_retention_days,
  max_images_per_generation,
  is_active,
  sort_order
)
values (
  'trial',
  'ทดลองใช้ฟรี',
  'สิทธิ์ทดลองใช้ฟรี 10 รูปจากโค้ดแคมเปญ',
  0,
  10,
  false,
  false,
  30,
  5,
  false,
  0
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_monthly_thb = excluded.price_monthly_thb,
  monthly_image_limit = excluded.monthly_image_limit,
  has_special_features = excluded.has_special_features,
  has_vip_support = excluded.has_vip_support,
  history_retention_days = excluded.history_retention_days,
  max_images_per_generation = excluded.max_images_per_generation,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  label text not null check (char_length(label) between 1 and 120),
  plan_id uuid not null references plans(id),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at)
);

create table if not exists promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references promo_codes(id),
  user_id uuid not null references users(id) on delete cascade,
  subscription_id uuid not null references subscriptions(id),
  redeemed_at timestamptz not null default now(),
  unique (promo_code_id, user_id),
  unique (user_id),
  unique (subscription_id)
);

create index if not exists promo_codes_active_window_idx
  on promo_codes(is_active, starts_at, expires_at);

insert into promo_codes (code_hash, label, plan_id)
select
  encode(digest('LAZYFREE10', 'sha256'), 'hex'),
  'Launch free trial campaign',
  plan.id
from plans plan
where plan.slug = 'trial'
on conflict (code_hash) do nothing;
