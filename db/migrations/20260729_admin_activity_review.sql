-- Move approval into the main admin dashboard and keep search-discovered
-- candidates unverified until an admin checks the original source.

update game_activities activity
set
  verification_status = 'UNKNOWN',
  confidence_score = least(activity.confidence_score, 69),
  updated_at = now()
from game_sources source
where activity.game_id = source.game_id
  and activity.source_name = source.name
  and activity.source_url like 'https://news.google.com/%'
  and source.automation_mode in ('SEARCH_DISCOVERY', 'MANUAL_REVIEW')
  and activity.status in ('DISCOVERED', 'REVIEWING');
