import { randomUUID } from 'node:crypto';
import { getDb } from '../db';
import { readMedia,writeMedia,deleteMedia } from '../media/storage';
import { settle } from '../media/repository';
import { settleMotion } from './repository';
import { analyzeMotion } from './analyze';
import { renderMotion } from './render';
import type { MotionPlan } from './model';
import {renderFrame} from '../frame/render';
import {boundedMedia,frameBrand} from '../frame/resources';
import type {FramePlan} from '../frame/model';
type Job = { id:string;shop_id:string;source_asset_id:string;output_asset_id:string|null;state:string;plan:MotionPlan;attempts:number;pathname:string;size_bytes:string;mode:'motion'|'frame';clip_asset_id:string|null;frame_plan:FramePlan|null;brand_version:number };
export async function claimMotion() {
  return getDb().begin(async tx => {
    const [job] = await tx<Job[]>`select j.*,a.pathname,a.size_bytes from motion_jobs j join media_assets a on a.id=j.source_asset_id where j.state in ('analyzing','queued','running','retry') and j.available_at<=now() and (j.lease_token is null or j.lease_until<now()) order by j.created_at for update of j skip locked limit 1`;
    if (!job) return null;
    const lease = randomUUID();
    await tx`update motion_jobs set state=${job.state==='analyzing'?'analyzing':'running'},lease_token=${lease},lease_until=now()+interval '10 minutes',updated_at=now() where id=${job.id}`;
    return {...job,lease};
  });
}
async function sourceBytes(job: Job) {
  const file = await readMedia(job.pathname);
  if (!file || file.size!==Number(job.size_bytes) || file.size>10*1024*1024) { await file?.stream.cancel(); throw new Error('source_unavailable'); }
  const reader=file.stream.getReader(),parts:Uint8Array[]=[]; let size=0;
  const timer=setTimeout(()=>{void reader.cancel();},60_000);
  try { while (true) {const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>file.size){await reader.cancel();throw new Error('size_mismatch');}parts.push(part.value);} }
  finally {clearTimeout(timer);}
  if(size!==file.size)throw new Error('size_mismatch');return Buffer.concat(parts);
}
export async function runMotion() {
  const job=await claimMotion(); if(!job)return false;
  const db=getDb();
  const beat=setInterval(()=>{void db`update motion_jobs set lease_until=now()+interval '10 minutes' where id=${job.id} and lease_token=${job.lease} and lease_until>now()`.catch(()=>{});},30_000);
  try {
    // Old processes have bounded I/O. Wait one hour before reclaiming their private output paths.
    const orphans=await db`select * from motion_attempts where job_id=${job.id} and not adopted and not cleaned`;
    for(const attempt of orphans) {
      if(new Date(attempt.started_at).getTime()>Date.now()-3600000) {
        await db`update motion_jobs set state='retry',available_at=${new Date(new Date(attempt.started_at).getTime()+3600000)},lease_token=null,lease_until=null where id=${job.id} and lease_token=${job.lease}`;
        return true;
      }
      await deleteMedia(attempt.pathname);
      await db`update motion_attempts set cleaned=true,finished_at=coalesce(finished_at,now()),outcome=coalesce(outcome,'lease_expired') where lease_token=${attempt.lease_token}`;
    }
    if(job.state!=='analyzing' && job.attempts>=3) {
      await db.begin(async tx=>{
        await tx`select id from shops where id=${job.shop_id} for update`;
        const [current]=await tx`select id from motion_jobs where id=${job.id} and lease_token=${job.lease} and lease_until>now() for update`;
        if(!current)return;
        await settleMotion(tx,job.id,false);await settle(tx,job.output_asset_id!,false);
        await tx`update media_assets set state='deleted' where id=${job.output_asset_id}`;
        await tx`update motion_jobs set state='failed',error_code='render_failed',lease_token=null,lease_until=null,updated_at=now() where id=${job.id}`;
      });return true;
    }
    const bytes=await sourceBytes(job);
    if(job.state==='analyzing') {
      const analysis=await analyzeMotion(bytes);
      await db`update motion_jobs set state='review',plan=${db.json(analysis.plan)},analysis_source=${analysis.source},revision=revision+1,lease_token=null,lease_until=null,updated_at=now() where id=${job.id} and lease_token=${job.lease} and lease_until>now()`;
      return true;
    }
    const pathname=`media/${job.shop_id}/${job.lease}.mp4`;
    await db.begin(async tx=>{
      const [current]=await tx`select id from motion_jobs where id=${job.id} and lease_token=${job.lease} and lease_until>now() for update`;
      if(!current)throw new Error('lease_lost');
      await tx`insert into motion_attempts(lease_token,job_id,pathname) values (${job.lease},${job.id},${pathname})`;
      await tx`update motion_jobs set attempts=attempts+1 where id=${job.id}`;
    });
    let output:Awaited<ReturnType<typeof renderMotion>>;
    if(job.mode==='frame'){
      const [clip]=await db`select pathname,size_bytes from media_assets where id=${job.clip_asset_id} and shop_id=${job.shop_id} and kind='video' and state='ready'`;
      if(!clip||!job.frame_plan)throw new Error('clip_unavailable');
      const {brand,logo}=await frameBrand(job.shop_id,job.brand_version,job.frame_plan.logo);
      output=await renderFrame(bytes,await boundedMedia(clip.pathname,100*1024*1024,Number(clip.size_bytes)),job.frame_plan,brand,logo);
    }else output=await renderMotion(bytes,job.plan);
    await writeMedia(pathname,output.bytes,'video/mp4');
    await db.begin(async tx=>{
      await tx`select id from shops where id=${job.shop_id} for update`;
      const [current]=await tx`select id from motion_jobs where id=${job.id} and lease_token=${job.lease} and lease_until>now() for update`;
      if(!current)return;
      const [reservation]=await tx`select * from quota_reservations where asset_id=${job.output_asset_id} for update`;
      const difference=Number(reservation.units)-output.bytes.length;
      if(difference<0)throw new Error('output_limit');
      await tx`update usage_buckets set reserved_units=reserved_units-${difference} where id=${reservation.bucket_id}`;
      // Store a separate adjustment ledger event so the reservation history remains auditable.
      await tx`insert into usage_ledger(reservation_id,event,units) values (${reservation.id},'resize',${-difference})`;
      await tx`update quota_reservations set units=${output.bytes.length} where id=${reservation.id}`;
      await settle(tx,job.output_asset_id!,true);await settleMotion(tx,job.id,true);
      await tx`update media_assets set state='ready',pathname=${pathname},size_bytes=${output.bytes.length},metadata=${tx.json(output.metadata)},expires_at=now()+(select retention_days from media_policy where id)*interval '1 day' where id=${job.output_asset_id}`;
      await tx`update motion_attempts set adopted=true,finished_at=now(),outcome='completed' where lease_token=${job.lease}`;
      await tx`update motion_jobs set state='succeeded',error_code=null,lease_token=null,lease_until=null,updated_at=now() where id=${job.id}`;
    });
  } catch {
    if(job.state==='analyzing') {
      // Even provider/storage failure leaves a reviewable manual plan; render still validates the source.
      await db`update motion_jobs set state='review',analysis_source='manual',revision=revision+1,lease_token=null,lease_until=null,error_code='analysis_unavailable',updated_at=now() where id=${job.id} and lease_token=${job.lease} and lease_until>now()`;
    } else {
      await db`update motion_attempts set finished_at=now(),outcome='render_failed' where lease_token=${job.lease}`;
      await db`update motion_jobs set state='retry',attempts=greatest(attempts,${job.attempts+1}),error_code='render_retry',available_at=now()+interval '1 hour',lease_token=null,lease_until=null,updated_at=now() where id=${job.id} and lease_token=${job.lease} and lease_until>now()`;
    }
  } finally {clearInterval(beat);}
  return true;
}
export async function expireMotionReviews() {
  await getDb()`update motion_jobs set state='cancelled',lease_token=null,lease_until=null,updated_at=now() where state in ('review','analyzing') and review_deadline<now()`;
}
