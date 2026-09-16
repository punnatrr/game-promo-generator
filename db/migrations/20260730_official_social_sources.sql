-- Seed verified official social accounts for every tracked game.
-- Social platforms remain MANUAL_REVIEW sources because their public pages do
-- not expose a stable feed contract. Safe to apply repeatedly.

with social_sources(
  slug, name, url, language, adapter_key
) as (
  values
    ('efootball', 'eFootball Official Facebook', 'https://www.facebook.com/playeFootball', 'en', null),
    ('efootball', 'eFootball Official Instagram', 'https://www.instagram.com/efootball/', 'en', null),
    ('efootball', 'eFootball Official X', 'https://x.com/play_efootball', 'en', null),

    ('cookierun-classic', 'CookieRun Classic Official Facebook', 'https://www.facebook.com/CRClassicEN', 'en', 'cookierun-classic-manual'),
    ('cookierun-classic', 'CookieRun Classic Official Instagram', 'https://www.instagram.com/crclassic_en/', 'en', null),
    ('cookierun-classic', 'CookieRun Classic Official X', 'https://x.com/CRClassicEN', 'en', null),

    ('roblox', 'Roblox Official Facebook', 'https://www.facebook.com/roblox/', 'en', null),
    ('roblox', 'Roblox Official Instagram', 'https://www.instagram.com/roblox/', 'en', null),
    ('roblox', 'Roblox Official TikTok', 'https://www.tiktok.com/@roblox', 'en', null),
    ('roblox', 'Roblox Official X', 'https://x.com/Roblox', 'en', null),

    ('free-fire', 'Free Fire Thailand Official Facebook', 'https://www.facebook.com/freefireth', 'th', null),
    ('free-fire', 'Free Fire Thailand Official Instagram', 'https://www.instagram.com/freefireth/', 'th', null),
    ('free-fire-max', 'Free Fire MAX (shared Free Fire Thailand) Official Facebook', 'https://www.facebook.com/freefireth', 'th', null),
    ('free-fire-max', 'Free Fire MAX (shared Free Fire Thailand) Official Instagram', 'https://www.instagram.com/freefireth/', 'th', null),

    ('ragnarok-the-new-world', 'Ragnarok: The New World Official Facebook', 'https://www.facebook.com/RagnarokTheNewWorld.Gravity', 'en', 'ragnarok-the-new-world-manual'),

    ('fc-mobile', 'EA SPORTS FC Mobile Official Facebook', 'https://www.facebook.com/EASFCMobile/', 'en', null),
    ('fc-mobile', 'EA SPORTS FC Mobile Official Instagram', 'https://www.instagram.com/easfcmobile/', 'en', null),
    ('fc-mobile', 'EA SPORTS FC Mobile Official X', 'https://x.com/EASFCMOBILE', 'en', null),

    ('garena-rov', 'Garena RoV Thailand Official Facebook', 'https://www.facebook.com/ROVTH/', 'th', null),
    ('garena-rov', 'Garena RoV Thailand Official Instagram', 'https://www.instagram.com/garena_rov_official/', 'th', null),
    ('garena-rov', 'Garena RoV Thailand Official X', 'https://x.com/garenarovth', 'th', null),

    ('pubg-mobile', 'PUBG MOBILE Official Facebook', 'https://www.facebook.com/PUBGMobile', 'en', null),
    ('pubg-mobile', 'PUBG MOBILE Official Instagram', 'https://www.instagram.com/pubgmobile', 'en', null),
    ('pubg-mobile', 'PUBG MOBILE Official TikTok', 'https://www.tiktok.com/@pubgmobile', 'en', null),
    ('pubg-mobile', 'PUBG MOBILE Official X', 'https://x.com/PUBGMobile', 'en', null),

    ('mobile-legends', 'Mobile Legends: Bang Bang Official Facebook', 'https://www.facebook.com/mobilelegendsgame', 'en', 'mobile-legends-manual'),
    ('mobile-legends', 'Mobile Legends: Bang Bang Official Instagram', 'https://www.instagram.com/mobilelegendsgame/', 'en', null),
    ('mobile-legends', 'Mobile Legends: Bang Bang Official X', 'https://x.com/MobileLegendsOL', 'en', null),

    ('whiteout-survival', 'Whiteout Survival Official Facebook', 'https://www.facebook.com/WhiteoutSurvival', 'en', null),
    ('whiteout-survival', 'Whiteout Survival Official Instagram', 'https://www.instagram.com/whiteoutsurvival', 'en', null),
    ('whiteout-survival', 'Whiteout Survival Official TikTok', 'https://www.tiktok.com/@whiteoutsurvivalofficial', 'en', null),
    ('whiteout-survival', 'Whiteout Survival Official X', 'https://x.com/WOS_Global', 'en', null),

    ('kingshot', 'Kingshot Official Facebook', 'https://www.facebook.com/61560003321785', 'en', 'kingshot-manual'),

    ('last-war', 'Last War: Survival Game Official Facebook', 'https://www.facebook.com/lastwarsurvival', 'en', null),
    ('last-war', 'Last War: Survival Game Official Instagram', 'https://www.instagram.com/lastwarsurvival_official', 'en', null),
    ('last-war', 'Last War: Survival Game Official X', 'https://x.com/lastwarsurvival', 'en', null),

    ('digimon-up', 'DIGIMON UP Official Facebook', 'https://www.facebook.com/digimon.up.en/', 'en', null),
    ('digimon-up', 'DIGIMON UP Official X', 'https://x.com/Digimon_up_en', 'en', null),

    ('soul-land-awakening-world', 'Soul Land: Awakening World Official Facebook', 'https://www.facebook.com/profile.php?id=61586910441563', 'en', null),
    ('soul-land-awakening-world', 'Soul Land: Awakening World Official TikTok', 'https://www.tiktok.com/@aichagag2o6', 'en', null),

    ('honkai-star-rail', 'Honkai: Star Rail Thailand Official Facebook', 'https://www.facebook.com/HonkaiStarRail.TH', 'th', null),
    ('honkai-star-rail', 'Honkai: Star Rail Official Instagram', 'https://www.instagram.com/honkaistarrail/', 'en', null),
    ('honkai-star-rail', 'Honkai: Star Rail Official TikTok', 'https://www.tiktok.com/@honkaistarrail_official', 'en', null),
    ('honkai-star-rail', 'Honkai: Star Rail Official X', 'https://x.com/honkaistarrail', 'en', null),

    ('love-and-deepspace', 'Love and Deepspace Official Facebook', 'https://www.facebook.com/LoveandDeepspaceEN', 'en', null),
    ('love-and-deepspace', 'Love and Deepspace Official X', 'https://x.com/Love_Deepspace', 'en', null),

    ('genshin-impact', 'Genshin Impact Official Facebook', 'https://www.facebook.com/Genshinimpact/', 'en', null),
    ('genshin-impact', 'Genshin Impact Official Instagram', 'https://www.instagram.com/genshinimpact/', 'en', null),
    ('genshin-impact', 'Genshin Impact Official TikTok', 'https://www.tiktok.com/@genshinimpact_en', 'en', null),
    ('genshin-impact', 'Genshin Impact Official X', 'https://x.com/GenshinImpact', 'en', null),

    ('wuthering-waves', 'Wuthering Waves Thailand Official Facebook', 'https://www.facebook.com/WutheringWavesTH.Official', 'th', null),
    ('wuthering-waves', 'Wuthering Waves Official Instagram', 'https://www.instagram.com/wuthering_waves', 'en', null),
    ('wuthering-waves', 'Wuthering Waves Official TikTok', 'https://www.tiktok.com/@wutheringwaves_official', 'en', null),
    ('wuthering-waves', 'Wuthering Waves Thailand Official X', 'https://x.com/WW_TH_Official', 'th', null),

    ('valorant', 'VALORANT Thailand Official Facebook', 'https://www.facebook.com/VALORANTth', 'th', null),
    ('valorant', 'VALORANT Official Instagram', 'https://www.instagram.com/valorant/', 'en', null),
    ('valorant', 'VALORANT Thailand Official TikTok', 'https://www.tiktok.com/@valorantth', 'th', null),
    ('valorant', 'VALORANT Official X', 'https://x.com/VALORANT', 'en', null)
)
insert into game_sources (
  game_id,
  name,
  url,
  source_type,
  credibility_score,
  language,
  adapter_key,
  automation_mode,
  limitation_note,
  is_active
)
select
  game.id,
  social_sources.name,
  social_sources.url,
  'OFFICIAL_SOCIAL',
  100,
  social_sources.language,
  social_sources.adapter_key,
  'MANUAL_REVIEW',
  'Verified official social account. Collect only indexed posts from the previous 7 days and require Admin review.',
  true
from social_sources
join games game on game.slug = social_sources.slug
on conflict (game_id, url)
do update set
  name = excluded.name,
  source_type = excluded.source_type,
  credibility_score = excluded.credibility_score,
  language = excluded.language,
  adapter_key = excluded.adapter_key,
  automation_mode = excluded.automation_mode,
  limitation_note = excluded.limitation_note,
  is_active = true,
  updated_at = now();
