import { createHash, randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { getDb } from '../db';
import { EMPTY_BRAND } from '../brand/model';
import { FILE_TYPES, MediaError, type Library, type MediaProject, type Asset, type MediaJob, type parseUpload, type parseProject } from './model';
type Tx = postgres.TransactionSql;
export async function shopFor(tx: Tx, userId: string) {
  await tx`insert into shops (owner_user_id) values (${userId}::uuid) on conflict (owner_user_id) do nothing`;
  const [shop] = await tx<{ id: string; current_brand_version: number }[]>`select id, current_brand_version from shops where owner_user_id=${userId}::uuid for update`;
  if (shop.current_brand_version === 0) {
    await tx`insert into brand_profiles (shop_id,version,profile,created_by) values (${shop.id},1,${tx.json(EMPTY_BRAND)},${userId})`;
    await tx`update shops set current_brand_version=1 where id=${shop.id}`;
    shop.current_brand_version = 1;
  }
  return shop;
}
export async function library(userId: string): Promise<Omit<Library, 'storageAvailable'>> {
  const db = getDb();
  const [policy] = await db`select * from media_policy where id`;
  const [shop] = await db`select id from shops where owner_user_id=${userId}::uuid`;
  const empty = { assets: [], jobs: [], projects: [], usage: { limit: Number(policy.storage_limit_bytes), reserved: 0, used: 0 }, limits: { image: Number(policy.max_image_bytes), video: Number(policy.max_video_bytes), retentionDays: policy.retention_days as number } };
  if (!shop) return empty;
  const [assets, jobs, projects, buckets] = await Promise.all([
    db<Asset[]>`select id,name,kind,state,size_bytes,expires_at,metadata from media_assets where shop_id=${shop.id} and state <> 'deleted' order by created_at desc limit 100`,
    db<MediaJob[]>`select id,asset_id,state,kind,error_code,attempts from media_jobs where shop_id=${shop.id} order by updated_at desc limit 100`,
    db<MediaProject[]>`select p.id,v.title,p.current_version,v.brand_version,p.expires_at,coalesce(array_agg(a.asset_id) filter (where a.asset_id is not null),'{}') as asset_ids from media_projects p join media_project_versions v on v.project_id=p.id and v.version=p.current_version left join media_project_assets a on a.project_id=v.project_id and a.version=v.version where p.shop_id=${shop.id} group by p.id,v.title,v.brand_version order by p.created_at desc limit 100`,
    db`select * from usage_buckets where shop_id=${shop.id} and meter='storage_bytes'`,
  ]);
  const bucket = buckets[0];
  return { ...empty, assets: assets.map(a => ({ ...a, size_bytes: Number(a.size_bytes) })), jobs, projects, usage: bucket ? { limit: Number(bucket.limit_units), reserved: Number(bucket.reserved_units), used: Number(bucket.used_units) } : empty.usage };
}
export async function createAsset(userId: string, input: ReturnType<typeof parseUpload>) {
  const db = getDb(); const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return db.begin(async tx => {
    const shop = await shopFor(tx, userId);
    const [existing] = await tx`select id,pathname,request_hash from media_assets where shop_id=${shop.id} and request_key=${input.requestKey}::uuid`;
    if (existing) { if (existing.request_hash !== hash) throw new MediaError('รหัสคำขอถูกใช้กับไฟล์อื่นแล้ว', 409); return { id: existing.id as string, pathname: existing.pathname as string }; }
    const [policy] = await tx`select * from media_policy where id`;
    const max = Number(input.kind === 'image' ? policy.max_image_bytes : policy.max_video_bytes);
    if (input.size > max) throw new MediaError('ไฟล์เกินขนาดที่คลังรองรับ', 413);
    const [recent] = await tx`select count(*)::int as n from media_assets where shop_id=${shop.id} and created_at>now()-interval '1 hour'`;
    if (recent.n >= 30) throw new MediaError('อัปโหลดบ่อยเกินไป กรุณาลองใหม่ภายหลัง', 429);
    const [count] = await tx`select count(*)::int as n from media_assets where shop_id=${shop.id} and state<>'deleted'`;
    if (count.n >= 100) throw new MediaError('คลังรองรับ 100 ไฟล์ กรุณาลบไฟล์ที่ไม่ใช้ก่อน', 409);
    await tx`insert into usage_buckets (shop_id,meter,limit_units) values (${shop.id},'storage_bytes',${policy.storage_limit_bytes}) on conflict (shop_id) where meter='storage_bytes' do nothing`;
    const [bucket] = await tx`select * from usage_buckets where shop_id=${shop.id} and meter='storage_bytes' for update`;
    if (Number(bucket.used_units) + Number(bucket.reserved_units) + input.size > Number(bucket.limit_units)) throw new MediaError('พื้นที่ไม่พอ กรุณาลบไฟล์ที่ไม่ได้ใช้และรอคืนพื้นที่ก่อน', 409);
    const assetId = randomUUID(); const pathname = `media/${shop.id}/${assetId}.${FILE_TYPES[input.contentType]}`;
    await tx`insert into media_assets (id,shop_id,name,kind,declared_type,size_bytes,pathname,expires_at,request_key,request_hash) values (${assetId},${shop.id},${input.name},${input.kind},${input.contentType},${input.size},${pathname},now()+${policy.retention_days}*interval '1 day',${input.requestKey},${hash})`;
    const [reservation] = await tx`insert into quota_reservations (shop_id,bucket_id,asset_id,units) values (${shop.id},${bucket.id},${assetId},${input.size}) returning id`;
    await tx`update usage_buckets set reserved_units=reserved_units+${input.size} where id=${bucket.id}`;
    await tx`insert into usage_ledger (reservation_id,event,units) values (${reservation.id},'reserve',${input.size})`;
    return { id: assetId, pathname };
  });
}
export async function uploadPermission(userId: string, pathname: string) {
  const db = getDb();
  const [asset] = await db`update media_assets a set token_issued=true from shops s where a.shop_id=s.id and s.owner_user_id=${userId}::uuid and a.pathname=${pathname} and a.state='uploading' and a.upload_deadline>now() returning a.*`;
  if (!asset) throw new MediaError('สิทธิ์อัปโหลดหมดอายุหรือไฟล์ถูกส่งแล้ว กรุณาเลือกไฟล์ใหม่', 409);
  return asset;
}
export async function enqueueAsset(assetId: string, pathname: string, userId?: string) {
  const db = getDb();
  return db.begin(async tx => {
    const [asset] = await tx`select a.* from media_assets a join shops s on s.id=a.shop_id where a.id=${assetId}::uuid and a.pathname=${pathname} and (${userId || null}::uuid is null or s.owner_user_id=${userId || null}::uuid) for update of a`;
    if (!asset) throw new MediaError('ไม่พบไฟล์', 404);
    if (asset.state !== 'uploading') return;
    await tx`update media_assets set state='queued' where id=${asset.id}`;
    await tx`insert into media_jobs (shop_id,asset_id) values (${asset.shop_id},${asset.id}) on conflict (asset_id) do nothing`;
  });
}
export async function ownAsset(userId: string, assetId: string) {
  const db = getDb();
  const [asset] = await db`select a.* from media_assets a join shops s on s.id=a.shop_id where a.id=${assetId}::uuid and s.owner_user_id=${userId}::uuid`;
  if (!asset) throw new MediaError('ไม่พบไฟล์', 404);
  return asset;
}
export async function deleteAsset(userId: string, assetId: string) {
  const db = getDb();
  await db.begin(async tx => {
    const shop = await shopFor(tx, userId);
    const [asset] = await tx`select * from media_assets where id=${assetId}::uuid and shop_id=${shop.id} for update`;
    if (!asset) throw new MediaError('ไม่พบไฟล์', 404);
    const [motion] = await tx`select 1 from motion_jobs where shop_id=${shop.id} and (source_asset_id=${assetId} or clip_asset_id=${assetId} or output_asset_id=${assetId}) and state in ('analyzing','review','queued','running','retry') limit 1`;
    if (motion) throw new MediaError('ไฟล์นี้กำลังใช้ในงานวิดีโอ กรุณารอผลหรือยกเลิกงานวิดีโอก่อน',409);
    const [ref] = await tx`select 1 from media_project_assets where asset_id=${assetId} limit 1`;
    if (ref) throw new MediaError('ไฟล์นี้อยู่ในชุดงานหรือเวอร์ชันเก่า กรุณาลบชุดงานที่อ้างอิงก่อน', 409);
    if (asset.state === 'deleted') return;
    await tx`update media_assets set state='deleting' where id=${assetId}`;
    // Changing the lease fences any verifier still running; cleanup waits for its I/O window.
    const safeAfter = asset.token_issued ? new Date(new Date(asset.upload_deadline).getTime() + 86400000) : new Date();
    await tx`insert into media_jobs (shop_id,asset_id,kind,available_at) values (${shop.id},${assetId},'delete',greatest(now()+interval '2 minutes',${safeAfter})) on conflict (asset_id) do update set kind='delete',state='queued',terminal_status='cancelled',lease_token=null,lease_until=null,available_at=greatest(now()+interval '2 minutes',media_jobs.lease_until,${safeAfter}),updated_at=now()`;
  });
}
export async function saveProject(userId: string, input: ReturnType<typeof parseProject>) {
  const db = getDb();
  return db.begin(async tx => {
    const shop = await shopFor(tx, userId);
    const [current] = await tx`select * from media_projects where id=${input.id}::uuid and shop_id=${shop.id} for update`;
    if ((current ? current.current_version : 0) !== input.version) throw new MediaError('ชุดงานมีการแก้ไขแล้ว กรุณาโหลดข้อมูลใหม่', 409);
    if (!current) {
      const [count] = await tx`select count(*)::int as n from media_projects where shop_id=${shop.id}`;
      if (count.n >= 100) throw new MediaError('เก็บชุดงานได้สูงสุด 100 ชุด กรุณาลบชุดที่ไม่ได้ใช้', 409);
    }
    const assets = await tx`select id from media_assets where shop_id=${shop.id} and id in ${tx(input.assetIds)} and state='ready' and expires_at>now() for update`;
    if (assets.length !== input.assetIds.length) throw new MediaError('บางไฟล์ยังไม่พร้อม หมดอายุ หรือไม่ใช่ไฟล์ของคุณ');
    const [policy] = await tx`select retention_days from media_policy where id`;
    const version = input.version + 1;
    if (!current) await tx`insert into media_projects (id,shop_id,current_version,expires_at) values (${input.id},${shop.id},${version},now()+${policy.retention_days}*interval '1 day')`;
    else await tx`update media_projects set current_version=${version},expires_at=now()+${policy.retention_days}*interval '1 day' where id=${input.id}`;
    await tx`insert into media_project_versions (project_id,shop_id,version,title,brand_version) values (${input.id},${shop.id},${version},${input.title},${shop.current_brand_version})`;
    for (const assetId of input.assetIds) await tx`insert into media_project_assets (project_id,version,shop_id,asset_id) values (${input.id},${version},${shop.id},${assetId})`;
    // All revisions retain their inputs until the project retention window ends.
    await tx`update media_assets set expires_at=greatest(expires_at,now()+${policy.retention_days}*interval '1 day') where id in (select asset_id from media_project_assets where project_id=${input.id})`;
    return { id: input.id, version };
  });
}
export async function deleteProject(userId: string, projectId: string) {
  const db = getDb();
  await db.begin(async tx => { const shop = await shopFor(tx, userId); await tx`delete from media_projects where id=${projectId}::uuid and shop_id=${shop.id}`; });
}
export async function settle(tx: Tx, assetId: string, charge: boolean) {
  const [r] = await tx`select * from quota_reservations where asset_id=${assetId} for update`;
  if (!r || r.status === 'released' || (charge && r.status === 'charged')) return;
  if (charge) await tx`update usage_buckets set reserved_units=reserved_units-${r.units},used_units=used_units+${r.units} where id=${r.bucket_id}`;
  else if (r.status === 'reserved') await tx`update usage_buckets set reserved_units=reserved_units-${r.units} where id=${r.bucket_id}`;
  else await tx`update usage_buckets set used_units=used_units-${r.units} where id=${r.bucket_id}`;
  await tx`update quota_reservations set status=${charge ? 'charged' : 'released'} where id=${r.id}`;
  await tx`insert into usage_ledger (reservation_id,event,units) values (${r.id},${charge ? 'charge' : 'release'},${r.units}) on conflict do nothing`;
}
