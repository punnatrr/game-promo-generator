-- M3: apply after the M2 media library. No paid plans or image credits are changed.
alter table usage_ledger drop constraint usage_ledger_event_check;
alter table usage_ledger add constraint usage_ledger_event_check check(event in ('reserve','resize','charge','release'));
create table motion_entitlements (
  shop_id uuid primary key references shops(id),
  enabled boolean not null default false,
  monthly_limit integer not null check (monthly_limit between 0 and 10000)
);
-- Access is explicitly granted per shop during pilot; absence means disabled.
create table motion_jobs (
  id uuid primary key,
  shop_id uuid not null references shops(id),
  source_asset_id uuid not null,
  output_asset_id uuid,
  brand_version integer not null,
  title text not null check (char_length(title) between 1 and 100),
  state text not null default 'analyzing' check (state in ('analyzing','review','queued','running','retry','succeeded','failed','cancelled')),
  plan jsonb not null,
  revision integer not null default 1,
  analysis_source text not null default 'pending' check (analysis_source in ('pending','vision','manual')),
  request_hash text not null,
  render_hash text,
  attempts integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  available_at timestamptz not null default now(),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  review_deadline timestamptz not null default now()+interval '24 hours',
  unique(id,shop_id),
  foreign key(source_asset_id,shop_id) references media_assets(id,shop_id),
  foreign key(output_asset_id,shop_id) references media_assets(id,shop_id),
  foreign key(shop_id,brand_version) references brand_profiles(shop_id,version)
);
create index motion_jobs_claim on motion_jobs(available_at,created_at) where state in ('analyzing','queued','running','retry');
create table motion_reservations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique,
  shop_id uuid not null,
  bucket_id uuid not null,
  status text not null default 'reserved' check(status in ('reserved','charged','released')),
  foreign key(job_id,shop_id) references motion_jobs(id,shop_id),
  foreign key(bucket_id,shop_id) references usage_buckets(id,shop_id)
);
create table motion_ledger (
  reservation_id uuid not null references motion_reservations(id),
  event text not null check(event in ('reserve','charge','release')),
  created_at timestamptz not null default now(),
  primary key(reservation_id,event)
);
create table motion_attempts (
  lease_token uuid primary key,
  job_id uuid not null references motion_jobs(id),
  pathname text not null unique,
  adopted boolean not null default false,
  cleaned boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text
);
