-- M5 only. Explicit pilot grants; no subscription benefits or image/video quotas changed.
create table ads_entitlements (
  shop_id uuid primary key references shops(id),
  enabled boolean not null default false,
  monthly_limit integer not null default 0 check (monthly_limit between 0 and 500)
);
create table ads_plans (
  id uuid primary key,
  shop_id uuid not null references shops(id),
  brand_version integer not null,
  asset_id uuid,
  asset_name text,
  brief jsonb not null,
  result jsonb not null,
  request_hash text not null,
  analysis_state text not null check (analysis_state in ('rules','running','ai','fallback')),
  review jsonb,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (shop_id,brand_version) references brand_profiles(shop_id,version),
  foreign key (asset_id,shop_id) references media_assets(id,shop_id)
);
create index ads_plans_owner_created on ads_plans(shop_id,created_at desc);
