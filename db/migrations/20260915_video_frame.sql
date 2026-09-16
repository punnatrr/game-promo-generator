-- M4 shares M3's durable queue, render credits and storage reservations.
alter table motion_jobs add column mode text not null default 'motion' check(mode in ('motion','frame'));
alter table motion_jobs add column clip_asset_id uuid;
alter table motion_jobs add column frame_plan jsonb;
alter table motion_jobs add constraint motion_clip_owner_fk foreign key(clip_asset_id,shop_id) references media_assets(id,shop_id);
alter table motion_jobs add constraint motion_frame_inputs_check check((mode='motion' and clip_asset_id is null and frame_plan is null) or (mode='frame' and clip_asset_id is not null and frame_plan is not null));
create index motion_active_clip on motion_jobs(clip_asset_id) where state in ('review','queued','running','retry');
