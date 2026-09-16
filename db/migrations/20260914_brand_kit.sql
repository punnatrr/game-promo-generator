-- Additive M1 migration. Existing users, subscriptions and generations are unchanged.
create table shops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references users(id),
  current_brand_version integer not null default 0 check (current_brand_version >= 0),
  created_at timestamptz not null default now()
);

create table brand_logos (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id),
  blob_pathname text not null unique,
  ready boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_user_id, id)
);

-- Append-only through the application: future jobs pin shop_id + version.
create table brand_profiles (
  shop_id uuid not null references shops(id),
  version integer not null check (version > 0),
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  primary key (shop_id, version)
);

alter table shops add constraint shops_current_brand_fk
  foreign key (id, current_brand_version) references brand_profiles(shop_id, version)
  deferrable initially deferred;
-- Shops are inserted and their first profile saved in the same transaction.
