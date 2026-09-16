insert into plans (
  slug,
  name,
  description,
  price_monthly_thb,
  monthly_image_limit,
  has_special_features,
  has_vip_support,
  history_retention_days,
  max_images_per_generation,
  is_active,
  sort_order
) values
  (
    'trial',
    'ทดลองใช้ฟรี',
    'สิทธิ์ทดลองใช้ฟรี 10 รูปจากโค้ดแคมเปญ',
    0,
    10,
    false,
    false,
    30,
    5,
    false,
    0
  ),
  (
    'basic',
    'Basic',
    '15 รูปต่อเดือน สำหรับเริ่มใช้งาน',
    199,
    15,
    false,
    false,
    30,
    5,
    true,
    10
  ),
  (
    'pro',
    'Pro',
    '30 รูปต่อเดือน พร้อมฟีเจอร์พิเศษ',
    499,
    30,
    true,
    false,
    30,
    5,
    true,
    20
  ),
  (
    'business',
    'Business',
    '100 รูปต่อเดือน พร้อมฟีเจอร์พิเศษและบริการ VIP',
    999,
    100,
    true,
    true,
    30,
    5,
    true,
    30
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_monthly_thb = excluded.price_monthly_thb,
  monthly_image_limit = excluded.monthly_image_limit,
  has_special_features = excluded.has_special_features,
  has_vip_support = excluded.has_vip_support,
  history_retention_days = excluded.history_retention_days,
  max_images_per_generation = excluded.max_images_per_generation,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into promo_codes (code_hash, label, plan_id)
select
  encode(digest('LAZYFREE10', 'sha256'), 'hex'),
  'Launch free trial campaign',
  plan.id
from plans plan
where plan.slug = 'trial'
on conflict (code_hash) do nothing;
