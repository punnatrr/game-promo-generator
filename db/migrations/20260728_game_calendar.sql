-- Game Calendar extension for the existing Game Content tables.
-- Apply after 20260728_game_content.sql.

alter table game_activities
  add column if not exists title_th text,
  add column if not exists summary text,
  add column if not exists summary_th text,
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists timezone text not null default 'Asia/Bangkok',
  add column if not exists server text not null default 'ALL',
  add column if not exists version text,
  add column if not exists patch_number text,
  add column if not exists featured_characters jsonb not null default '[]'::jsonb,
  add column if not exists featured_skins jsonb not null default '[]'::jsonb,
  add column if not exists featured_items jsonb not null default '[]'::jsonb,
  add column if not exists content_angles jsonb not null default '[]'::jsonb,
  add column if not exists keywords jsonb not null default '[]'::jsonb,
  add column if not exists importance_score integer not null default 0,
  add column if not exists importance_reasons jsonb not null default '[]'::jsonb,
  add column if not exists community_interest_score integer not null default 0,
  add column if not exists community_interest_reasons jsonb not null default '[]'::jsonb,
  add column if not exists content_opportunity_score integer not null default 0,
  add column if not exists content_opportunity_reasons jsonb not null default '[]'::jsonb,
  add column if not exists external_post_id text,
  add column if not exists review_status text not null default 'PENDING',
  add column if not exists published_status text not null default 'DRAFT',
  add column if not exists is_rumor boolean not null default false,
  add column if not exists requires_review boolean not null default true,
  add column if not exists is_demo boolean not null default false,
  add column if not exists deduplication_key text,
  add column if not exists conflict_warning text;

alter table game_sources
  add column if not exists etag text,
  add column if not exists last_modified text,
  add column if not exists cursor_value text,
  add column if not exists consecutive_failures integer not null default 0;

alter table crawler_runs
  add column if not exists retry_count integer not null default 0,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists game_activity_revisions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references game_activities(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  change_type text not null,
  previous_value jsonb,
  next_value jsonb,
  created_at timestamptz not null default now()
);

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  notification_type text not null,
  activity_id uuid references game_activities(id) on delete set null,
  status text not null default 'PENDING',
  attempt_count integer not null default 0,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists game_activities_deduplication_key_idx
  on game_activities(deduplication_key)
  where deduplication_key is not null;
create index if not exists game_activities_calendar_date_idx
  on game_activities(start_date, end_date);
create index if not exists game_activities_game_category_idx
  on game_activities(game_id, category, status);
create index if not exists game_activities_scores_idx
  on game_activities(importance_score desc, community_interest_score desc, content_opportunity_score desc);
create index if not exists game_activities_review_idx
  on game_activities(requires_review, review_status, published_status);
create index if not exists game_activity_revisions_activity_idx
  on game_activity_revisions(activity_id, created_at desc);
create index if not exists crawler_runs_started_idx
  on crawler_runs(started_at desc);
