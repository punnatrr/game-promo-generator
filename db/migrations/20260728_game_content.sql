create extension if not exists pgcrypto;

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
  source_type text not null check (
    source_type in (
      'OFFICIAL_WEBSITE', 'OFFICIAL_SOCIAL', 'IN_GAME', 'APP_STORE',
      'OFFICIAL_COMMUNITY', 'TRUSTED_MEDIA', 'COMMUNITY', 'DATAMINING'
    )
  ),
  credibility_score integer not null default 50
    check (credibility_score between 0 and 100),
  language text not null default 'th',
  is_active boolean not null default true,
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
  activity_type text not null check (
    activity_type in (
      'NEW_CHARACTER', 'NEW_SKIN', 'NEW_ITEM', 'NEW_PACKAGE', 'BATTLE_PASS',
      'TOPUP_EVENT', 'GACHA', 'COLLABORATION', 'ANNIVERSARY',
      'SEASON_UPDATE', 'VERSION_UPDATE', 'NEW_MODE', 'NEW_MAP',
      'REDEEM_CODE', 'SALE', 'OTHER'
    )
  ),
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
  verification_status text not null default 'UNKNOWN' check (
    verification_status in (
      'OFFICIAL', 'CONFIRMED', 'TEASER', 'RUMOR', 'DATAMINED', 'UNKNOWN'
    )
  ),
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  popularity_score integer not null default 0 check (popularity_score between 0 and 100),
  monetization_score integer not null default 0 check (monetization_score between 0 and 100),
  urgency_score integer not null default 0 check (urgency_score between 0 and 100),
  content_priority text not null default 'LOW'
    check (content_priority in ('URGENT', 'HIGH', 'MEDIUM', 'LOW')),
  content_priority_score integer not null default 0
    check (content_priority_score between 0 and 100),
  content_deadline timestamptz,
  recommended_publish_date timestamptz,
  thumbnail_url text,
  official_image_url text,
  tags jsonb not null default '[]'::jsonb,
  raw_content text,
  ai_summary_th text,
  ai_caption_th text,
  content_angle text,
  status text not null default 'DISCOVERED' check (
    status in (
      'DISCOVERED', 'REVIEWING', 'APPROVED', 'PLANNED', 'DESIGNING',
      'SCHEDULED', 'PUBLISHED', 'SKIPPED', 'EXPIRED'
    )
  ),
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
  discovered_count integer not null default 0,
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

create index if not exists games_active_name_idx on games(is_active, name);
create index if not exists game_sources_game_active_idx
  on game_sources(game_id, is_active, credibility_score desc);
create index if not exists game_activities_dashboard_idx
  on game_activities(status, content_priority_score desc, start_date);
create index if not exists game_activities_verification_idx
  on game_activities(verification_status, discovered_at desc);
create index if not exists content_calendar_schedule_idx
  on content_calendar(scheduled_at, status);

insert into games (slug, name, icon_url) values
  ('efootball', 'eFootball', '/game-icons/efootball.jpg'),
  ('cookierun-classic', 'CookieRun Classic', '/game-icons/cookierun-classic.jpg'),
  ('roblox', 'Roblox', '/game-icons/roblox.jpg'),
  ('free-fire', 'Free Fire', '/game-icons/free-fire.jpg'),
  ('free-fire-max', 'Free Fire MAX', '/game-icons/free-fire-max.jpg'),
  ('ragnarok-the-new-world', 'Ragnarok: The New World', '/game-icons/ragnarok-the-new-world.jpg'),
  ('fc-mobile', 'EA SPORTS FC Mobile', '/game-icons/fc-mobile.jpg'),
  ('garena-rov', 'Garena RoV', '/game-icons/garena-rov.jpg'),
  ('pubg-mobile', 'PUBG Mobile', '/game-icons/pubg-mobile.jpg'),
  ('mobile-legends', 'Mobile Legends: Bang Bang', '/game-icons/mobile-legends.jpg'),
  ('whiteout-survival', 'Whiteout Survival', '/game-icons/whiteout-survival.jpg'),
  ('kingshot', 'Kingshot', '/game-icons/kingshot.jpg'),
  ('last-war', 'Last War: Survival Game', '/game-icons/last-war.jpg'),
  ('digimon-up', 'DIGIMON UP', '/game-icons/digimon-up.jpg'),
  ('soul-land-awakening-world', 'Soul Land: Awakening World', '/game-icons/soul-land-awakening-world.jpg'),
  ('honkai-star-rail', 'Honkai: Star Rail', '/game-icons/honkai-star-rail.jpg'),
  ('love-and-deepspace', 'Love and Deepspace', '/game-icons/love-and-deepspace.jpg'),
  ('genshin-impact', 'Genshin Impact', '/game-icons/genshin-impact.jpg'),
  ('wuthering-waves', 'Wuthering Waves', '/game-icons/wuthering-waves.jpg'),
  ('valorant', 'Valorant', '/game-icons/valorant.png')
on conflict (slug) do nothing;

insert into game_sources (
  game_id, name, url, source_type, credibility_score, language
)
select
  g.id,
  source.name,
  source.url,
  source.source_type,
  source.credibility_score,
  source.language
from games g
join (
  values
    ('efootball', 'eFootball Official', 'https://www.konami.com/efootball/en-us/', 'OFFICIAL_WEBSITE', 100, 'en'),
    ('cookierun-classic', 'CookieRun Classic Official', 'https://www.facebook.com/CRClassicEN', 'OFFICIAL_SOCIAL', 100, 'en'),
    ('roblox', 'Roblox Official Updates', 'https://devforum.roblox.com/c/updates/45', 'OFFICIAL_COMMUNITY', 98, 'en'),
    ('free-fire', 'Free Fire Official Thailand', 'https://www.freefiremobile.com/th/news/', 'OFFICIAL_WEBSITE', 100, 'th'),
    ('free-fire-max', 'Free Fire MAX Official Thailand', 'https://www.freefiremobile.com/th/news/', 'OFFICIAL_WEBSITE', 100, 'th'),
    ('ragnarok-the-new-world', 'Ragnarok: The New World Official', 'https://www.facebook.com/RagnarokTheNewWorld.Gravity', 'OFFICIAL_SOCIAL', 100, 'en'),
    ('fc-mobile', 'EA SPORTS FC Mobile Official', 'https://www.ea.com/en/games/ea-sports-fc/fc-mobile/news', 'OFFICIAL_WEBSITE', 100, 'en'),
    ('garena-rov', 'Garena RoV Thailand', 'https://www.facebook.com/ROVTH', 'OFFICIAL_SOCIAL', 100, 'th'),
    ('pubg-mobile', 'PUBG MOBILE Official', 'https://www.pubgmobile.com/en-US/news.shtml', 'OFFICIAL_WEBSITE', 100, 'en'),
    ('mobile-legends', 'Mobile Legends: Bang Bang Official', 'https://www.facebook.com/mobilelegendsgame', 'OFFICIAL_SOCIAL', 100, 'en'),
    ('whiteout-survival', 'Whiteout Survival Official', 'https://www.facebook.com/WhiteoutSurvival', 'OFFICIAL_SOCIAL', 100, 'en'),
    ('kingshot', 'Kingshot Official', 'https://www.facebook.com/61560003321785', 'OFFICIAL_SOCIAL', 100, 'en'),
    ('last-war', 'Last War Official', 'https://www.lastwar.com/', 'OFFICIAL_WEBSITE', 100, 'en'),
    ('digimon-up', 'DIGIMON UP Official', 'https://dgup.bn-ent.net/en/', 'OFFICIAL_WEBSITE', 100, 'en'),
    ('soul-land-awakening-world', 'Soul Land: Awakening World Official', 'https://gevents.37games.com/official_slmsea/index.html', 'OFFICIAL_WEBSITE', 100, 'en'),
    ('honkai-star-rail', 'Honkai: Star Rail Official', 'https://hsr.hoyoverse.com/en-us/news', 'OFFICIAL_WEBSITE', 100, 'en'),
    ('love-and-deepspace', 'Love and Deepspace Official', 'https://loveanddeepspace.infoldgames.com/en-EN/news', 'OFFICIAL_WEBSITE', 100, 'en'),
    ('genshin-impact', 'Genshin Impact Official', 'https://genshin.hoyoverse.com/en/news', 'OFFICIAL_WEBSITE', 100, 'en'),
    ('wuthering-waves', 'Wuthering Waves Official', 'https://wutheringwaves.kurogames.com/en/', 'OFFICIAL_WEBSITE', 100, 'en'),
    ('valorant', 'VALORANT Thailand Official', 'https://playvalorant.com/th-th/news/', 'OFFICIAL_WEBSITE', 100, 'th')
) as source(
  game_slug, name, url, source_type, credibility_score, language
) on source.game_slug = g.slug
on conflict (game_id, url) do nothing;
