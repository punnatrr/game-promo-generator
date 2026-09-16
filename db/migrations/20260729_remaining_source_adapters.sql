-- Complete the per-game Source Adapter rollout.
-- Safe to apply repeatedly after 20260728_game_source_adapters.sql.

with replacements(slug, previous_url, current_url) as (
  values
    (
      'efootball',
      'https://www.konami.com/efootball/en-us/',
      'https://www.konami.com/efootball/en-us/topic/news/list'
    ),
    (
      'garena-rov',
      'https://www.facebook.com/ROVTH',
      'https://rov.in.th/patch-notes'
    ),
    (
      'last-war',
      'https://www.lastwar.com/',
      'https://www.lastwar.com/en/home.html'
    ),
    (
      'digimon-up',
      'https://dgup.bn-ent.net/en/',
      'https://dgup.bn-ent.net/en/news/'
    ),
    (
      'love-and-deepspace',
      'https://loveanddeepspace.infoldgames.com/en-EN/news',
      'https://loveanddeepspace.infoldgames.com/en-EN/'
    ),
    (
      'wuthering-waves',
      'https://wutheringwaves.kurogames.com/en/',
      'https://wutheringwaves.kurogames.com/en/main/news'
    )
)
update game_sources source
set url = replacements.current_url
from replacements
where source.game_id = (
    select id from games where slug = replacements.slug
  )
  and source.url = replacements.previous_url
  and not exists (
    select 1
    from game_sources current_source
    where current_source.game_id = source.game_id
      and current_source.url = replacements.current_url
  );

with config(
  slug, url, name, source_type, adapter_key, automation_mode, limitation_note
) as (
  values
    (
      'efootball',
      'https://www.konami.com/efootball/en-us/topic/news/list',
      'eFootball Official',
      'OFFICIAL_WEBSITE',
      'efootball-official-news',
      'ADAPTER',
      'Parses Konami newsData and keeps mobile-supported announcements.'
    ),
    (
      'cookierun-classic',
      'https://www.facebook.com/CRClassicEN',
      'CookieRun Classic Official',
      'OFFICIAL_SOCIAL',
      'cookierun-classic-manual',
      'MANUAL_REVIEW',
      'Facebook has no stable public feed; only CRClassicEN is allowed.'
    ),
    (
      'free-fire-max',
      'https://www.freefiremobile.com/th/news/',
      'Free Fire MAX Official Thailand',
      'OFFICIAL_WEBSITE',
      'free-fire-max-official-news',
      'ADAPTER',
      'Free Fire MAX shares the official Free Fire announcement list.'
    ),
    (
      'ragnarok-the-new-world',
      'https://www.facebook.com/RagnarokTheNewWorld.Gravity',
      'Ragnarok: The New World Official',
      'OFFICIAL_SOCIAL',
      'ragnarok-the-new-world-manual',
      'MANUAL_REVIEW',
      'Facebook has no stable public feed and is reviewed manually.'
    ),
    (
      'fc-mobile',
      'https://www.ea.com/en/games/ea-sports-fc/fc-mobile/news',
      'EA SPORTS FC Mobile Official',
      'OFFICIAL_WEBSITE',
      'fc-mobile-official-news',
      'ADAPTER',
      'Parses only EA embedded FC Mobile news fallback data.'
    ),
    (
      'garena-rov',
      'https://rov.in.th/patch-notes',
      'Garena RoV Thailand Patch Notes',
      'OFFICIAL_WEBSITE',
      'garena-rov-patch-notes',
      'ADAPTER',
      'Parses only Garena RoV Thailand patch notes.'
    ),
    (
      'kingshot',
      'https://www.facebook.com/61560003321785',
      'Kingshot Official',
      'OFFICIAL_SOCIAL',
      'kingshot-manual',
      'MANUAL_REVIEW',
      'Facebook has no stable public feed and is reviewed manually.'
    ),
    (
      'last-war',
      'https://www.lastwar.com/en/home.html',
      'Last War Official',
      'OFFICIAL_WEBSITE',
      'last-war-manual',
      'MANUAL_REVIEW',
      'The official site has no stable server-rendered news feed.'
    ),
    (
      'digimon-up',
      'https://dgup.bn-ent.net/en/news/',
      'DIGIMON UP Official',
      'OFFICIAL_WEBSITE',
      'digimon-up-official-news',
      'ADAPTER',
      'Parses Bandai Namco English news cards.'
    ),
    (
      'soul-land-awakening-world',
      'https://gevents.37games.com/official_slmsea/index.html',
      'Soul Land: Awakening World Official',
      'OFFICIAL_WEBSITE',
      'soul-land-awakening-world-manual',
      'MANUAL_REVIEW',
      'The official page relies on an undocumented internal API.'
    ),
    (
      'honkai-star-rail',
      'https://hsr.hoyoverse.com/en-us/news',
      'Honkai: Star Rail Official',
      'OFFICIAL_WEBSITE',
      'honkai-star-rail-manual',
      'MANUAL_REVIEW',
      'The official page relies on an undocumented internal service.'
    ),
    (
      'love-and-deepspace',
      'https://loveanddeepspace.infoldgames.com/en-EN/',
      'Love and Deepspace Official',
      'OFFICIAL_WEBSITE',
      'love-and-deepspace-manual',
      'MANUAL_REVIEW',
      'No stable public news-list contract is available.'
    ),
    (
      'genshin-impact',
      'https://genshin.hoyoverse.com/en/news',
      'Genshin Impact Official',
      'OFFICIAL_WEBSITE',
      'genshin-impact-manual',
      'MANUAL_REVIEW',
      'The official page relies on an undocumented internal service.'
    ),
    (
      'wuthering-waves',
      'https://wutheringwaves.kurogames.com/en/main/news',
      'Wuthering Waves Official',
      'OFFICIAL_WEBSITE',
      'wuthering-waves-manual',
      'MANUAL_REVIEW',
      'The official page is a dynamic shell without a stable public feed.'
    ),
    (
      'valorant',
      'https://playvalorant.com/th-th/news/',
      'VALORANT Thailand Official',
      'OFFICIAL_WEBSITE',
      'valorant-thailand-news',
      'ADAPTER',
      'Parses Thai Game Updates and Announcements, excluding Esports.'
    )
)
update game_sources source
set
  name = config.name,
  source_type = config.source_type,
  credibility_score = 100,
  adapter_key = config.adapter_key,
  automation_mode = config.automation_mode,
  limitation_note = config.limitation_note,
  is_active = true,
  updated_at = now()
from config
where source.game_id = (select id from games where slug = config.slug)
  and source.url = config.url;
