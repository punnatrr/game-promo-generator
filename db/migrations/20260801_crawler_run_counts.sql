-- Distinguish fetched candidates, newly inserted activities, and duplicates.
-- Existing rows keep counting_version = 1 because discovered_count previously
-- included duplicate activities. New runs use counting_version = 2.

alter table crawler_runs
  add column if not exists candidate_count integer not null default 0,
  add column if not exists duplicate_count integer not null default 0,
  add column if not exists counting_version integer not null default 1;

alter table crawler_runs
  alter column counting_version set default 2;
