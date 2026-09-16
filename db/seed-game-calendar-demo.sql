-- DEVELOPMENT ONLY. Never run this seed against production.
-- No dates or event facts are invented. Rows stay SKIPPED and are_demo=true.

insert into game_activities (
  game_id, title, title_th, activity_type, category, description,
  summary_th, source_name, source_url, source_type, verification_status,
  confidence_score, status, review_status, published_status, requires_review,
  is_demo, fingerprint, deduplication_key
)
select
  g.id,
  '[DEMO] ตัวอย่างกิจกรรมสำหรับทดสอบปฏิทิน',
  '[DEMO] ตัวอย่างกิจกรรมสำหรับทดสอบปฏิทิน',
  'OTHER',
  'OTHER',
  'ข้อมูลตัวอย่างสำหรับทดสอบ UI เท่านั้น ไม่ใช่ข่าวจริง',
  'ข้อมูลตัวอย่างสำหรับทดสอบ UI เท่านั้น ไม่ใช่ข่าวจริง',
  'DEMO DATA',
  'https://example.invalid/game-calendar-demo/' || g.slug,
  'COMMUNITY',
  'UNKNOWN',
  0,
  'SKIPPED',
  'REJECTED',
  'DRAFT',
  true,
  true,
  'demo-game-calendar-' || g.slug,
  'demo|' || g.id::text
from games g
where g.slug in (
  'efootball', 'cookierun-classic', 'roblox', 'free-fire', 'free-fire-max',
  'ragnarok-the-new-world', 'fc-mobile', 'garena-rov', 'pubg-mobile',
  'mobile-legends', 'whiteout-survival', 'kingshot', 'last-war', 'digimon-up',
  'soul-land-awakening-world', 'honkai-star-rail', 'love-and-deepspace',
  'genshin-impact', 'wuthering-waves', 'valorant'
)
on conflict (fingerprint) do nothing;
