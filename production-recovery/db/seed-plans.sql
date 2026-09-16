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
    'basic',
    'Basic',
    '15 images per month. No special features.',
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
    '30 images per month. Includes special features.',
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
    '100 images per month. Includes special features and VIP service.',
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
