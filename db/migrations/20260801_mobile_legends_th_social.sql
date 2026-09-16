-- The global Mobile Legends URL redirects Thai visitors to the official TH/LA
-- page. Keep the configured source on the canonical page URL used by posts.

update game_sources source
set
  name = 'Mobile Legends: Bang Bang Thailand Official Facebook',
  url = 'https://www.facebook.com/MobileLegendsGameTHLA/',
  language = 'th',
  updated_at = now()
where source.game_id = (select id from games where slug = 'mobile-legends')
  and lower(trim(trailing '/' from source.url)) =
    'https://www.facebook.com/mobilelegendsgame'
  and not exists (
    select 1
    from game_sources current_source
    where current_source.game_id = source.game_id
      and lower(trim(trailing '/' from current_source.url)) =
        'https://www.facebook.com/mobilelegendsgamethla'
  );

update game_sources source
set is_active = false, updated_at = now()
where source.game_id = (select id from games where slug = 'mobile-legends')
  and lower(trim(trailing '/' from source.url)) =
    'https://www.facebook.com/mobilelegendsgame'
  and exists (
    select 1
    from game_sources current_source
    where current_source.game_id = source.game_id
      and lower(trim(trailing '/' from current_source.url)) =
        'https://www.facebook.com/mobilelegendsgamethla'
  );
