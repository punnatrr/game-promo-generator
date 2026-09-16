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
  currency text not null default 'THB' check (currency ~ '^[A-Z]{3}$'),
  plan_slug_snapshot text not null,
  plan_name_snapshot text not null,
  plan_description_snapshot text not null,
  price_monthly_thb_snapshot integer not null check (price_monthly_thb_snapshot >= 0),
  monthly_image_limit_snapshot integer not null check (monthly_image_limit_snapshot >= 0),
  has_special_features_snapshot boolean not null,
  has_vip_support_snapshot boolean not null,
  history_retention_days_snapshot integer not null check (history_retention_days_snapshot > 0),
  max_images_per_generation_snapshot integer not null check (max_images_per_generation_snapshot > 0),
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
  currency text not null default 'THB' check (currency ~ '^[A-Z]{3}$'),
  plan_slug_snapshot text not null,
  plan_name_snapshot text not null,
  plan_description_snapshot text not null,
  price_monthly_thb_snapshot integer not null check (price_monthly_thb_snapshot >= 0),
  monthly_image_limit_snapshot integer not null check (monthly_image_limit_snapshot >= 0),
  has_special_features_snapshot boolean not null,
  has_vip_support_snapshot boolean not null,
  history_retention_days_snapshot integer not null check (history_retention_days_snapshot > 0),
  max_images_per_generation_snapshot integer not null check (max_images_per_generation_snapshot > 0),
  request_idempotency_key text check (
    request_idempotency_key is null
    or char_length(request_idempotency_key) between 8 and 128
  ),
  decision_idempotency_key text check (
    decision_idempotency_key is null
    or char_length(decision_idempotency_key) between 8 and 128
  ),
  paid_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table if not exists payment_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  uploaded_by_user_id uuid not null references users(id) on delete cascade,
  proof_image_url text not null,
  storage_provider text,
  blob_pathname text,
  content_type text check (
    content_type is null
    or content_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  size_bytes integer check (size_bytes is null or size_bytes between 1 and 5242880),
  original_filename text,
  note text,
  reviewed_by_user_id uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  review_status text not null default 'pending' check (
    review_status in ('pending', 'approved', 'rejected')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create table if not exists daily_images (
  id uuid primary key default gen_random_uuid(),
  game_name text not null,
  game_tag text not null default '',
  image_slot text not null check (image_slot in ('image1', 'image2')),
  image_url text not null,
  is_active boolean not null default true,
  uploaded_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create table if not exists support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 160),
  status text not null default 'open' check (
    status in ('open', 'in_progress', 'resolved')
  ),
  user_last_read_at timestamptz,
  admin_last_read_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references support_conversations(id) on delete cascade,
  sender_user_id uuid not null references users(id) on delete cascade,
  sender_role text not null check (sender_role in ('user', 'admin')),
  body text not null default '' check (char_length(body) <= 4000),
  created_at timestamptz not null default now()
);

create table if not exists support_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references support_messages(id) on delete cascade,
  uploaded_by_user_id uuid not null references users(id) on delete cascade,
  image_url text not null,
  blob_pathname text not null,
  content_type text not null check (
    content_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  size_bytes integer not null check (size_bytes between 1 and 3145728),
  original_filename text,
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

create index if not exists daily_images_game_slot_idx
  on daily_images(game_name, image_slot, is_active, created_at desc);

create index if not exists daily_images_game_tag_idx
  on daily_images(game_tag, image_slot, is_active, created_at desc);

create index if not exists payments_user_status_idx
  on payments(user_id, status, created_at);

create index if not exists support_conversations_user_activity_idx
  on support_conversations(user_id, last_message_at desc);

create index if not exists support_conversations_admin_queue_idx
  on support_conversations(status, last_message_at desc);

create index if not exists support_messages_conversation_created_idx
  on support_messages(conversation_id, created_at asc);

create index if not exists notifications_user_unread_idx
  on notifications(user_id, created_at desc)
  where read_at is null;

create index if not exists promo_codes_active_window_idx
  on promo_codes(is_active, starts_at, expires_at);

create index if not exists payments_pending_expiry_idx
  on payments(expires_at)
  where status = 'pending';

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

-- LAZY TOPUP Game Content
alter table users
  add column if not exists content_role text not null default 'VIEWER';

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists game_sources (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  url text not null,
  source_type text not null,
  credibility_score integer not null default 50,
  language text not null default 'th',
  is_active boolean not null default true,
  adapter_key text,
  automation_mode text not null default 'SEARCH_DISCOVERY',
  limitation_note text,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, url)
);

create table if not exists game_activities (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  title text not null,
  original_title text,
  activity_type text not null,
  description text not null default '',
  start_date timestamptz,
  end_date timestamptz,
  announcement_date timestamptz,
  expected_release_date timestamptz,
  region text not null default 'TH',
  platform text not null default 'ALL',
  source_name text not null,
  source_url text not null,
  source_type text not null,
  source_published_at timestamptz,
  discovered_at timestamptz not null default now(),
  verification_status text not null default 'UNKNOWN',
  confidence_score integer not null default 0,
  popularity_score integer not null default 0,
  monetization_score integer not null default 0,
  urgency_score integer not null default 0,
  content_priority text not null default 'LOW',
  content_priority_score integer not null default 0,
  content_deadline timestamptz,
  recommended_publish_date timestamptz,
  thumbnail_url text,
  official_image_url text,
  tags jsonb not null default '[]'::jsonb,
  raw_content text,
  ai_summary_th text,
  ai_caption_th text,
  content_angle text,
  status text not null default 'DISCOVERED',
  is_featured boolean not null default false,
  fingerprint text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now()
);

create table if not exists activity_sources (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references game_activities(id) on delete cascade,
  source_id uuid references game_sources(id) on delete set null,
  source_name text not null,
  source_url text not null,
  source_type text not null,
  source_published_at timestamptz,
  raw_content text,
  created_at timestamptz not null default now(),
  unique (activity_id, source_url)
);

create table if not exists activity_tags (
  activity_id uuid not null references game_activities(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (activity_id, tag)
);

create table if not exists content_tasks (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references game_activities(id) on delete cascade,
  assignee_user_id uuid references users(id) on delete set null,
  status text not null,
  note text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_calendar (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references game_activities(id) on delete cascade,
  calendar_type text not null,
  scheduled_at timestamptz not null,
  post_type text,
  status text not null default 'PLANNED',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists generated_contents (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references game_activities(id) on delete cascade,
  generated_by_user_id uuid references users(id) on delete set null,
  provider text not null,
  model text,
  output jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists activity_status_logs (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references game_activities(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  previous_status text,
  new_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists crawler_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  status text not null,
  source_count integer not null default 0,
  candidate_count integer not null default 0,
  discovered_count integer not null default 0,
  duplicate_count integer not null default 0,
  counting_version integer not null default 2,
  error_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists game_activities_dashboard_idx
  on game_activities(status, content_priority_score desc, start_date);
create index if not exists game_sources_game_active_idx
  on game_sources(game_id, is_active, credibility_score desc);
create index if not exists content_calendar_schedule_idx
  on content_calendar(scheduled_at, status);
