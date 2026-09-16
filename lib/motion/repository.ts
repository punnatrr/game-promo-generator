import { createHash, randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { getDb } from '../db';
import { shopFor, settle } from '../media/repository';
import { MediaError } from '../media/model';
import { storageAvailable } from '../media/storage';
import { DEFAULT_PLAN, OUTPUT_RESERVE, type MotionJob, type parseDraft, type parseRender } from './model';
import { parseFrame,validateFrameBrand,type FramePlan } from '../frame/model';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function studio(userId: string, mode: 'motion'|'frame' = 'motion') {
  const db = getDb();
  const [shop] = await db`select id from shops where owner_user_id=${userId}::uuid`;
  if (!shop) return { jobs: [],entitlement: { enabled:false,limit:0,used:0,reserved:0 },storageAvailable:storageAvailable() };
  const [grants,buckets,jobs] = await Promise.all([
    db`select * from motion_entitlements where shop_id=${shop.id}`,
    db`select * from usage_buckets where shop_id=${shop.id} and meter='video_render' and period_start=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'`,
    db<MotionJob[]>`select j.id,j.title,j.source_asset_id,j.output_asset_id,j.clip_asset_id,j.frame_plan,j.state,j.plan,j.revision,j.analysis_source,j.error_code,j.created_at,j.brand_version,coalesce(a.state='ready' and a.expires_at>now(),false) as output_ready from motion_jobs j left join media_assets a on a.id=j.output_asset_id where j.shop_id=${shop.id} and j.mode=${mode} order by j.created_at desc limit 100`,
  ]);
  return { jobs,entitlement: { enabled: Boolean(grants[0]?.enabled),limit: Number(buckets[0]?.limit_units ?? grants[0]?.monthly_limit ?? 0),used:Number(buckets[0]?.used_units || 0),reserved:Number(buckets[0]?.reserved_units || 0) },storageAvailable:storageAvailable() };
}
export async function createDraft(userId: string,input: ReturnType<typeof parseDraft>) {
  return getDb().begin(async tx => {
    const shop = await shopFor(tx,userId);
    const [old] = await tx`select id,request_hash from motion_jobs where id=${input.id}::uuid and shop_id=${shop.id}`;
    if (old) { if (old.request_hash !== hash(input)) throw new MediaError('คำขอนี้ถูกใช้แล้ว',409); return { id:old.id }; }
    const [grant] = await tx`select enabled from motion_entitlements where shop_id=${shop.id}`;
    if (!grant?.enabled) throw new MediaError('บัญชีนี้ยังไม่ได้เปิดสิทธิ์สร้างวิดีโอ',403);
    const [count] = await tx`select count(*)::int as n from motion_jobs where shop_id=${shop.id} and created_at>now()-interval '1 hour'`;
    if (count.n >= 10) throw new MediaError('สร้างแผนบ่อยเกินไป กรุณาลองใหม่ภายหลัง',429);
    const [asset] = await tx`select id from media_assets where id=${input.sourceAssetId}::uuid and shop_id=${shop.id} and kind='image' and state='ready' and expires_at>now() for update`;
    if (!asset) throw new MediaError('เลือกภาพที่พร้อมใช้จากคลังของคุณ',400);
    await tx`update media_assets set expires_at=greatest(expires_at,now()+interval '2 days') where id=${asset.id}`;
    await tx`insert into motion_jobs(id,shop_id,source_asset_id,brand_version,title,plan,request_hash) values (${input.id},${shop.id},${asset.id},${shop.current_brand_version},${input.title},${tx.json(DEFAULT_PLAN)},${hash(input)})`;
    return { id:input.id };
  });
}
export async function queueRender(userId: string,jobId: string,input: ReturnType<typeof parseRender>,frame?:FramePlan) {
  if (!storageAvailable()) throw new MediaError('พื้นที่เก็บวิดีโอยังไม่พร้อม',503);
  return getDb().begin(async tx => {
    const shop = await shopFor(tx,userId);
    const [job] = await tx`select * from motion_jobs where id=${jobId}::uuid and shop_id=${shop.id} for update`;
    if (!job) throw new MediaError('ไม่พบแผนวิดีโอ',404);
    if ((job.mode === 'frame') !== Boolean(frame)) throw new MediaError('ประเภทงานไม่ตรงกับคำขอ',400);
    const renderHash=hash(frame?{...input,frame}:input);
    if (job.render_hash === renderHash) return { id:job.id }; // Lost response/repeated click does not spend twice.
    if (job.state !== 'review' || job.revision !== input.revision || new Date(job.review_deadline).getTime() <= Date.now()) throw new MediaError('แผนเปลี่ยนแปลงหรือหมดอายุ กรุณาสร้างแผนใหม่',409);
    const [grant] = await tx`select * from motion_entitlements where shop_id=${shop.id}`;
    if (!grant?.enabled) throw new MediaError('บัญชีนี้ยังไม่ได้เปิดสิทธิ์สร้างวิดีโอ',403);
    const [source] = await tx`select id from media_assets where id=${job.source_asset_id} and state='ready' and expires_at>now() for update`;
    if (!source) throw new MediaError('ภาพต้นฉบับไม่พร้อมใช้งาน',409);
    if(frame){
      frame=parseFrame(frame);
      const [profile]=await tx`select profile from brand_profiles where shop_id=${shop.id} and version=${job.brand_version}`;
      validateFrameBrand(frame,profile.profile);
      const [clip]=await tx`select metadata from media_assets where id=${job.clip_asset_id} and shop_id=${shop.id} and kind='video' and state='ready' and expires_at>now() for update`;
      if(!clip||Number(clip.metadata.duration)+0.001<frame.start+frame.duration)throw new MediaError('ช่วงเวลาที่เลือกยาวเกินคลิปต้นฉบับ',400);
      await tx`update motion_jobs set frame_plan=${tx.json(frame)} where id=${job.id}`;
    }
    await tx`insert into usage_buckets(shop_id,meter,period_start,period_end,limit_units) values (${shop.id},'video_render',date_trunc('month',now() at time zone 'UTC') at time zone 'UTC',(date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC',${grant.monthly_limit}) on conflict do nothing`;
    const [bucket] = await tx`select * from usage_buckets where shop_id=${shop.id} and meter='video_render' and period_start=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' for update`;
    if (Number(bucket.used_units)+Number(bucket.reserved_units) >= Number(bucket.limit_units)) throw new MediaError('โควตาวิดีโอเดือนนี้หมดแล้ว',409);
    const [policy] = await tx`select * from media_policy where id`;
    await tx`insert into usage_buckets(shop_id,meter,limit_units) values (${shop.id},'storage_bytes',${policy.storage_limit_bytes}) on conflict (shop_id) where meter='storage_bytes' do nothing`;
    const [storage] = await tx`select * from usage_buckets where shop_id=${shop.id} and meter='storage_bytes' for update`;
    if (Number(storage.used_units)+Number(storage.reserved_units)+OUTPUT_RESERVE > Number(storage.limit_units)) throw new MediaError('ต้องมีพื้นที่ว่างอย่างน้อย 32 MB สำหรับสร้างวิดีโอ',409);
    const [count] = await tx`select count(*)::int as n from media_assets where shop_id=${shop.id} and state<>'deleted'`;
    if (count.n >= 100) throw new MediaError('คลังเต็ม กรุณาลบไฟล์ที่ไม่ใช้ก่อน',409);
    const output = randomUUID();
    await tx`insert into media_assets(id,shop_id,name,kind,declared_type,size_bytes,pathname,state,expires_at,request_key,request_hash) values (${output},${shop.id},${job.title+'.mp4'},'video','video/mp4',${OUTPUT_RESERVE},${`media/${shop.id}/${output}.mp4`},'queued',now()+${policy.retention_days}*interval '1 day',${output},${hash(input)})`;
    const [r] = await tx`insert into quota_reservations(shop_id,bucket_id,asset_id,units) values (${shop.id},${storage.id},${output},${OUTPUT_RESERVE}) returning id`;
    await tx`update usage_buckets set reserved_units=reserved_units+${OUTPUT_RESERVE} where id=${storage.id}`;
    await tx`insert into usage_ledger(reservation_id,event,units) values (${r.id},'reserve',${OUTPUT_RESERVE})`;
    const [credit] = await tx`insert into motion_reservations(job_id,shop_id,bucket_id) values (${job.id},${shop.id},${bucket.id}) returning id`;
    await tx`update usage_buckets set reserved_units=reserved_units+1 where id=${bucket.id}`;
    await tx`insert into motion_ledger values (${credit.id},'reserve',now())`;
    await tx`update motion_jobs set plan=${tx.json(input.plan)},revision=revision+1,render_hash=${renderHash},output_asset_id=${output},state='queued',attempts=0,available_at=now(),updated_at=now() where id=${job.id}`;
    return { id:job.id };
  });
}
export async function settleMotion(tx: postgres.TransactionSql,jobId: string,charge: boolean) {
  const [r] = await tx`select * from motion_reservations where job_id=${jobId} for update`;
  if (!r || r.status !== 'reserved') return;
  await tx`update usage_buckets set reserved_units=reserved_units-1,used_units=used_units+${charge ? 1 : 0} where id=${r.bucket_id}`;
  await tx`update motion_reservations set status=${charge ? 'charged':'released'} where id=${r.id}`;
  await tx`insert into motion_ledger values (${r.id},${charge ? 'charge':'release'},now()) on conflict do nothing`;
}
export async function cancelMotion(userId: string,jobId: string) {
  await getDb().begin(async tx => {
    const shop = await shopFor(tx,userId);
    const [job] = await tx`select * from motion_jobs where id=${jobId}::uuid and shop_id=${shop.id} for update`;
    if (!job) throw new MediaError('ไม่พบงาน',404);
    if (['succeeded','failed','cancelled'].includes(job.state)) return;
    // Running jobs are bounded and settle on completion; cancellation only before a worker owns it.
    if (job.lease_token && new Date(job.lease_until).getTime()>Date.now()) throw new MediaError('งานเริ่มแล้ว กรุณารอผลการสร้าง',409);
    if (job.output_asset_id) {
      // Prior attempts may have written orphan outputs. Cleanup must finish before storage is returned.
      const [attempt] = await tx`select 1 from motion_attempts where job_id=${job.id} and not cleaned and not adopted limit 1`;
      if (attempt) throw new MediaError('ระบบกำลังเก็บกวาดงานเดิม กรุณารอผล',409);
      await settle(tx,job.output_asset_id,false);
      await tx`update media_assets set state='deleted' where id=${job.output_asset_id}`;
    }
    await settleMotion(tx,job.id,false);
    await tx`update motion_jobs set state='cancelled',lease_token=null,lease_until=null,updated_at=now() where id=${job.id}`;
  });
}
