-- Per-game source adapters and explicit manual-review policy.
-- Safe to apply repeatedly after 20260728_game_content.sql.

alter table game_sources
  add column if not exists adapter_key text,
  add column if not exists automation_mode text not null default 'SEARCH_DISCOVERY',
  add column if not exists limitation_note text;

update game_sources
set
  name = 'Roblox Staff Announcements',
  url = 'https://devforum.roblox.com/c/updates/announcements/36.json',
  adapter_key = 'roblox-devforum-announcements',
  automation_mode = 'ADAPTER',
  limitation_note = 'Only Roblox staff announcements are parsed.'
where game_id = (select id from games where slug = 'roblox')
  and url in (
    'https://devforum.roblox.com/c/updates/45',
    'https://devforum.roblox.com/c/updates/announcements/36.json'
  );

update game_sources
set
  url = 'https://ff.garena.com/th/news/',
  adapter_key = 'free-fire-official-news',
  automation_mode = 'ADAPTER',
  limitation_note = 'Parses the server-rendered Thai Garena news list.'
where game_id = (select id from games where slug = 'free-fire')
  and url in (
    'https://www.freefiremobile.com/th/news/',
    'https://ff.garena.com/th/news/'
  );

update game_sources
set
  adapter_key = 'pubg-mobile-manual',
  automation_mode = 'MANUAL_REVIEW',
  limitation_note = 'The official page uses an undocumented signed internal API; no protection is bypassed.'
where game_id = (select id from games where slug = 'pubg-mobile')
  and url = 'https://www.pubgmobile.com/en-US/news.shtml';

update game_sources
set
  adapter_key = 'mobile-legends-manual',
  automation_mode = 'MANUAL_REVIEW',
  limitation_note = 'The official page and social source require manual review because no stable public feed is available.'
where game_id = (select id from games where slug = 'mobile-legends');

update game_sources
set
  automation_mode = 'MANUAL_REVIEW',
  limitation_note = 'Facebook does not provide a stable public feed for this source.'
where game_id = (select id from games where slug = 'whiteout-survival')
  and url = 'https://www.facebook.com/WhiteoutSurvival';
