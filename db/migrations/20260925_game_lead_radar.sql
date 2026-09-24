-- Game Lead Radar: additive workspace-scoped lead management.
-- Uses shops.id as the existing tenant/workspace boundary.
alter table games
  add column if not exists display_name text,
  add column if not exists category text not null default 'GAME',
  add column if not exists keywords jsonb not null default '[]'::jsonb;

update games set display_name = coalesce(display_name, name);

create table if not exists game_aliases (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  unique (game_id, normalized_alias)
);
create index if not exists game_aliases_lookup_idx on game_aliases(normalized_alias);

create table if not exists source_connectors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references shops(id) on delete cascade,
  source_type text not null,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED','ERROR')),
  config jsonb not null default '{}'::jsonb,
  last_received_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source_type, name)
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references shops(id) on delete cascade,
  source_type text not null default 'MANUAL',
  source_url text,
  source_external_id text,
  author_name text,
  author_external_id text,
  original_text text not null check (char_length(original_text) between 1 and 12000),
  normalized_text text not null,
  normalized_text_hash text not null,
  game_id uuid references games(id) on delete set null,
  intent text not null default 'OTHER',
  buyer_confidence numeric(5,4) not null default 0 check (buyer_confidence between 0 and 1),
  game_confidence numeric(5,4) not null default 0 check (game_confidence between 0 and 1),
  intent_confidence numeric(5,4) not null default 0 check (intent_confidence between 0 and 1),
  lead_score integer not null default 0 check (lead_score between 0 and 100),
  temperature text not null default 'LOW' check (temperature in ('HOT','WARM','POSSIBLE','LOW')),
  status text not null default 'NEW' check (status in ('NEW','REVIEWED','CONTACTED','WAITING','FOLLOW_UP','WON','LOST','IGNORED')),
  detected_currency text,
  detected_amount numeric(14,2),
  detected_package text,
  detected_budget numeric(14,2),
  detected_location text,
  detected_platform text,
  detected_region text,
  detected_device text,
  detected_urgency text,
  detected_payment_method text,
  language text,
  matched_keywords jsonb not null default '[]'::jsonb,
  ai_summary text,
  analysis_status text not null default 'AI_PENDING' check (analysis_status in ('AI_PENDING','AI_SUCCEEDED','AI_FAILED','RULES_ONLY','NEEDS_REVIEW')),
  is_duplicate boolean not null default false,
  duplicate_of uuid references leads(id) on delete set null,
  is_spam boolean not null default false,
  is_seller boolean not null default false,
  is_saved boolean not null default false,
  assigned_to uuid references users(id) on delete set null,
  follow_up_at timestamptz,
  follow_up_note text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_workspace_status_idx on leads(workspace_id,status,created_at desc);
create index if not exists leads_workspace_game_idx on leads(workspace_id,game_id,created_at desc);
create index if not exists leads_workspace_score_idx on leads(workspace_id,lead_score desc,created_at desc);
create index if not exists leads_workspace_first_seen_idx on leads(workspace_id,first_seen_at desc);
create index if not exists leads_workspace_hash_idx on leads(workspace_id,normalized_text_hash,last_seen_at desc);
create index if not exists leads_follow_up_idx on leads(workspace_id,follow_up_at) where follow_up_at is not null;
create unique index if not exists leads_workspace_external_uidx
  on leads(workspace_id,source_type,source_external_id)
  where source_external_id is not null;

create table if not exists lead_occurrences (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  workspace_id uuid not null references shops(id) on delete cascade,
  connector_id uuid references source_connectors(id) on delete set null,
  source_type text not null,
  source_url text,
  canonical_url text,
  source_external_id text,
  author_name text,
  author_identifier text,
  original_text text not null,
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists lead_occurrences_lead_idx on lead_occurrences(lead_id,discovered_at desc);
create index if not exists lead_occurrences_workspace_idx on lead_occurrences(workspace_id,discovered_at desc);
create unique index if not exists lead_occurrences_external_uidx
  on lead_occurrences(workspace_id,source_type,source_external_id)
  where source_external_id is not null;
create unique index if not exists lead_occurrences_url_uidx
  on lead_occurrences(workspace_id,canonical_url)
  where canonical_url is not null;

create table if not exists lead_ai_analysis (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  workspace_id uuid not null references shops(id) on delete cascade,
  model text not null,
  prompt_version text not null,
  analysis_version text not null,
  source_text_hash text not null,
  tokens integer,
  latency_ms integer,
  status text not null check (status in ('SUCCEEDED','FAILED')),
  result jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists lead_ai_analysis_cache_idx
  on lead_ai_analysis(workspace_id,lead_id,source_text_hash,prompt_version,model,created_at desc);

create table if not exists lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  workspace_id uuid not null references shops(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists lead_status_history_lead_idx on lead_status_history(lead_id,created_at desc);

create table if not exists lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  workspace_id uuid not null references shops(id) on delete cascade,
  author_user_id uuid references users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists lead_notes_lead_idx on lead_notes(lead_id,created_at desc);

create table if not exists lead_replies (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  workspace_id uuid not null references shops(id) on delete cascade,
  generated_by_user_id uuid references users(id) on delete set null,
  tone text not null default 'SHORT_FRIENDLY',
  content text not null check (char_length(content) between 1 and 4000),
  price_package_id uuid,
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);
create index if not exists lead_replies_lead_idx on lead_replies(lead_id,created_at desc);

create table if not exists reply_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references shops(id) on delete cascade,
  created_by_user_id uuid references users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  game_id uuid references games(id) on delete set null,
  intent text,
  content text not null check (char_length(content) between 1 and 4000),
  variables jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reply_templates_workspace_idx on reply_templates(workspace_id,active,name);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references shops(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (workspace_id,name)
);

create table if not exists lead_tags (
  lead_id uuid not null references leads(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  workspace_id uuid not null references shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id,tag_id)
);

create table if not exists lead_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references shops(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists lead_events_workspace_idx on lead_events(workspace_id,created_at desc);
create index if not exists lead_events_lead_idx on lead_events(lead_id,created_at desc);

create table if not exists lead_import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references shops(id) on delete cascade,
  created_by_user_id uuid references users(id) on delete set null,
  source_type text not null default 'CSV',
  status text not null default 'PROCESSING' check (status in ('PROCESSING','COMPLETED','FAILED')),
  imported_count integer not null default 0,
  duplicate_count integer not null default 0,
  invalid_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists user_lead_settings (
  workspace_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  minimum_lead_score integer not null default 0 check (minimum_lead_score between 0 and 100),
  ai_language text not null default 'th',
  default_reply_tone text not null default 'SHORT_FRIENDLY',
  duplicate_window_hours integer not null default 168 check (duplicate_window_hours between 1 and 2160),
  monitored_game_ids jsonb not null default '[]'::jsonb,
  custom_keywords jsonb not null default '{}'::jsonb,
  negative_keywords jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table if not exists notification_settings (
  workspace_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  hot_lead_enabled boolean not null default true,
  follow_up_enabled boolean not null default true,
  assigned_enabled boolean not null default true,
  import_completed_enabled boolean not null default true,
  minimum_hot_score integer not null default 80 check (minimum_hot_score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table if not exists lead_conversions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references shops(id) on delete cascade,
  lead_id uuid not null unique references leads(id) on delete cascade,
  revenue numeric(14,2),
  currency text not null default 'THB',
  game_id uuid references games(id) on delete set null,
  package text,
  note text,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists game_price_packages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references shops(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  currency_code text,
  amount numeric(14,2),
  package_name text,
  price_thb numeric(14,2) not null check (price_thb >= 0),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists game_price_packages_lookup_idx
  on game_price_packages(workspace_id,game_id,currency_code,amount,is_active);

insert into games (slug,name,display_name,icon_url,is_active,category,keywords)
values
  ('arena-breakout','Arena Breakout','Arena Breakout',null,true,'GAME','["arena breakout"]'::jsonb),
  ('arena-breakout-infinite','Arena Breakout Infinite','Arena Breakout Infinite',null,true,'GAME','["arena breakout infinite","abi"]'::jsonb),
  ('call-of-duty-mobile','Call of Duty Mobile','Call of Duty Mobile',null,true,'GAME','["codm","call of duty mobile"]'::jsonb),
  ('steam','Steam','Steam',null,true,'PLATFORM','["steam"]'::jsonb),
  ('playstation','PlayStation','PlayStation',null,true,'PLATFORM','["playstation","psn"]'::jsonb),
  ('xbox','Xbox','Xbox',null,true,'PLATFORM','["xbox"]'::jsonb),
  ('nintendo','Nintendo','Nintendo',null,true,'PLATFORM','["nintendo","eshop"]'::jsonb),
  ('aether-gazer','Aether Gazer','Aether Gazer',null,true,'GAME','["aether gazer"]'::jsonb)
on conflict (slug) do update
set display_name=excluded.display_name,
    category=excluded.category,
    keywords=excluded.keywords;

update games set display_name=coalesce(display_name,name);

with alias_seed(slug,alias) as (
  values
    ('valorant','valorant'),('valorant','valo'),('valorant','วาโล'),('valorant','วาโลแรนท์'),('valorant','vp'),
    ('roblox','roblox'),('roblox','โรบล็อก'),('roblox','robux'),('roblox','โรบัค'),('roblox','โรบัคซ์'),
    ('garena-rov','rov'),('garena-rov','arena of valor'),('garena-rov','อาร์โอวี'),('garena-rov','คูปอง rov'),
    ('free-fire','free fire'),('free-fire','freefire'),('free-fire','ฟีฟาย'),
    ('pubg-mobile','pubg mobile'),('pubg-mobile','pubg'),('pubg-mobile','uc'),
    ('mobile-legends','mobile legends'),('mobile-legends','mlbb'),('mobile-legends','เพชร ml'),
    ('genshin-impact','genshin impact'),('genshin-impact','genshin'),('genshin-impact','เกนชิน'),('genshin-impact','genesis crystals'),
    ('honkai-star-rail','honkai star rail'),('honkai-star-rail','hsr'),
    ('wuthering-waves','wuthering waves'),('wuthering-waves','wuwa'),
    ('whiteout-survival','whiteout survival'),('whiteout-survival','whiteout'),('whiteout-survival','wos'),
    ('kingshot','kingshot'),
    ('arena-breakout','arena breakout'),
    ('arena-breakout-infinite','arena breakout infinite'),('arena-breakout-infinite','abi'),
    ('call-of-duty-mobile','call of duty mobile'),('call-of-duty-mobile','codm'),('call-of-duty-mobile','cp'),
    ('efootball','efootball'),('efootball','efootball coin'),
    ('fc-mobile','fc mobile'),('fc-mobile','fc points'),
    ('steam','steam'),
    ('playstation','playstation'),('playstation','psn'),
    ('xbox','xbox'),
    ('nintendo','nintendo'),('nintendo','eshop'),
    ('aether-gazer','aether gazer')
)
insert into game_aliases(game_id,alias,normalized_alias)
select g.id,a.alias,lower(trim(a.alias))
from alias_seed a join games g on g.slug=a.slug
on conflict (game_id,normalized_alias) do nothing;
