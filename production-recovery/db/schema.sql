create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_provider_id text unique,
  email text not null unique,
  password_hash text,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price_monthly_thb integer not null check (price_monthly_thb >= 0),
  monthly_image_limit integer not null check (monthly_image_limit >= 0),
  has_special_features boolean not null default false,
  has_vip_support boolean not null default false,
  history_retention_days integer not null default 30 check (history_retention_days > 0),
  max_images_per_generation integer not null default 5 check (max_images_per_generation > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  plan_id uuid not null references plans(id),
  status text not null check (
    status in ('active', 'pending_payment', 'past_due', 'canceled', 'expired')
  ),
  payment_method text not null check (
    payment_method in ('promptpay', 'bank_transfer', 'card', 'manual')
  ),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  canceled_at timestamptz,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  plan_id uuid not null references plans(id),
  amount_thb integer not null check (amount_thb >= 0),
  method text not null check (method in ('promptpay', 'bank_transfer', 'card')),
  status text not null check (
    status in ('pending', 'paid', 'rejected', 'refunded', 'expired')
  ),
  provider text,
  provider_payment_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  uploaded_by_user_id uuid not null references users(id) on delete cascade,
  proof_image_url text not null,
  note text,
  reviewed_by_user_id uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  review_status text not null default 'pending' check (
    review_status in ('pending', 'approved', 'rejected')
  ),
  created_at timestamptz not null default now()
);

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  action text not null check (action in ('generate', 'refine')),
  model text not null,
  image_quality text not null,
  aspect_ratio text not null,
  requested_image_count integer not null check (requested_image_count > 0),
  generated_image_count integer not null default 0 check (generated_image_count >= 0),
  status text not null check (status in ('pending', 'succeeded', 'partial', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists generated_images (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references generations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  image_url text not null,
  thumbnail_url text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  generation_id uuid references generations(id) on delete set null,
  plan_id uuid references plans(id) on delete set null,
  action text not null check (action in ('generate', 'refine')),
  image_count integer not null check (image_count >= 0),
  model text not null,
  estimated_cost_thb numeric(10, 2),
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references users(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_status_idx
  on subscriptions(user_id, status, current_period_end);

create index if not exists user_sessions_token_hash_idx
  on user_sessions(token_hash, expires_at);

create index if not exists usage_events_user_period_idx
  on usage_events(user_id, created_at);

create index if not exists generated_images_user_expires_idx
  on generated_images(user_id, expires_at);

create index if not exists payments_user_status_idx
  on payments(user_id, status, created_at);
