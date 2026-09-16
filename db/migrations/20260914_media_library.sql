-- M2 follows 20260914_brand_kit.sql. No existing image quota or plans are changed.
create table media_policy (
  id boolean primary key default true check (id),
  storage_limit_bytes bigint not null check (storage_limit_bytes > 0),
  max_image_bytes bigint not null check (max_image_bytes > 0),
  max_video_bytes bigint not null check (max_video_bytes > 0),
  retention_days integer not null check (retention_days between 1 and 365)
);
-- Pilot infrastructure caps, not purchased plan entitlements or video credits.
insert into media_policy values (true, 524288000, 10485760, 104857600, 30);

create table usage_buckets (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  meter text not null check (meter in ('storage_bytes', 'video_render')),
  period_start timestamptz not null default now(),
  period_end timestamptz,
  subscription_id uuid references subscriptions(id),
  limit_units bigint not null check (limit_units >= 0),
  reserved_units bigint not null default 0 check (reserved_units >= 0),
  used_units bigint not null default 0 check (used_units >= 0),
  unique (shop_id, meter, period_start),
  unique (id, shop_id),
  check (used_units + reserved_units <= limit_units),
  check (period_end is null or period_end > period_start)
);
create unique index one_storage_bucket_per_shop on usage_buckets(shop_id) where meter = 'storage_bytes';

create table media_assets (
  id uuid primary key,
  shop_id uuid not null references shops(id),
  name text not null check (char_length(name) between 1 and 160),
  kind text not null check (kind in ('image', 'video')),
  declared_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  pathname text not null unique,
  state text not null default 'uploading' check (state in ('uploading','queued','ready','deleting','deleted','rejected')),
  metadata jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  upload_deadline timestamptz not null default now() + interval '15 minutes',
  token_issued boolean not null default false,
  request_key uuid not null,
  request_hash text not null,
  unique (shop_id, request_key),
  unique (id, shop_id)
);
create table quota_reservations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  bucket_id uuid not null,
  asset_id uuid not null unique,
  units bigint not null check (units > 0),
  status text not null default 'reserved' check (status in ('reserved','charged','released')),
  foreign key (bucket_id, shop_id) references usage_buckets(id, shop_id),
  foreign key (asset_id, shop_id) references media_assets(id, shop_id)
);
create table usage_ledger (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references quota_reservations(id),
  event text not null check (event in ('reserve','charge','release')),
  units bigint not null,
  created_at timestamptz not null default now(),
  unique (reservation_id, event)
);
create table media_jobs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  asset_id uuid not null unique,
  kind text not null default 'verify' check (kind in ('verify','delete')),
  state text not null default 'queued' check (state in ('queued','running','retry','succeeded','failed','cancelled')),
  terminal_status text not null default 'cancelled' check (terminal_status in ('failed','cancelled')),
  attempts integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  available_at timestamptz not null default now(),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (asset_id, shop_id) references media_assets(id, shop_id)
);
create index media_jobs_claim on media_jobs(available_at, created_at) where state in ('queued','retry','running');
create index media_assets_owner_created on media_assets(shop_id, created_at desc);
create table media_job_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references media_jobs(id),
  lease_token uuid not null unique,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text
);
create table media_projects (
  id uuid primary key,
  shop_id uuid not null references shops(id),
  current_version integer not null check (current_version > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (id, shop_id)
);
create table media_project_versions (
  project_id uuid not null,
  shop_id uuid not null,
  version integer not null check (version > 0),
  title text not null check (char_length(title) between 1 and 100),
  brand_version integer not null,
  created_at timestamptz not null default now(),
  primary key (project_id, version),
  unique (project_id, version, shop_id),
  foreign key (project_id, shop_id) references media_projects(id, shop_id) on delete cascade,
  foreign key (shop_id, brand_version) references brand_profiles(shop_id, version)
);
create table media_project_assets (
  project_id uuid not null,
  version integer not null,
  shop_id uuid not null,
  asset_id uuid not null,
  primary key (project_id, version, asset_id),
  foreign key (project_id, version, shop_id) references media_project_versions(project_id, version, shop_id) on delete cascade,
  foreign key (asset_id, shop_id) references media_assets(id, shop_id)
);
