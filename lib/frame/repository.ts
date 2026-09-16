import {createHash} from 'node:crypto';
import {getDb} from '../db';
import {shopFor} from '../media/repository';
import {MediaError} from '../media/model';
import {DEFAULT_PLAN} from '../motion/model';
import {DEFAULT_FRAME,parseFrame,type FramePlan,type parseFrameDraft} from './model';
import type {BrandProfile} from '../brand/model';
export async function createFrameDraft(userId:string,input:ReturnType<typeof parseFrameDraft>){
  const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return getDb().begin(async tx=>{
    const shop=await shopFor(tx,userId);
    const [old]=await tx`select id,request_hash,mode from motion_jobs where id=${input.id}::uuid and shop_id=${shop.id}`;
    if(old){if(old.request_hash!==hash||old.mode!=='frame')throw new MediaError('รหัสคำขอนี้ถูกใช้แล้ว',409);return {id:old.id};}
    const [grant]=await tx`select enabled from motion_entitlements where shop_id=${shop.id}`;
    if(!grant?.enabled)throw new MediaError('บัญชีนี้ยังไม่ได้เปิดสิทธิ์สร้างวิดีโอ',403);
    const [count]=await tx`select count(*)::int as n from motion_jobs where shop_id=${shop.id} and created_at>now()-interval '1 hour'`;
    if(count.n>=10)throw new MediaError('สร้างแผนบ่อยเกินไป กรุณาลองใหม่ภายหลัง',429);
    const assets=await tx`select id,kind,metadata from media_assets where shop_id=${shop.id} and id in ${tx([input.sourceAssetId,input.clipAssetId])} and state='ready' and expires_at>now() order by id for update`;
    if(!assets.some(a=>a.id===input.sourceAssetId&&a.kind==='image')||!assets.some(a=>a.id===input.clipAssetId&&a.kind==='video'&&a.metadata?.duration>=6))throw new MediaError('เลือกภาพและคลิปอย่างน้อย 6 วินาทีที่พร้อมใช้จากคลังของคุณ');
    const [profile]=await tx<{profile:BrandProfile}[]>`select profile from brand_profiles where shop_id=${shop.id} and version=${shop.current_brand_version}`;
    const frame={...DEFAULT_FRAME,cta:profile.profile.defaultCta.length<=60?profile.profile.defaultCta:''};
    await tx`update media_assets set expires_at=greatest(expires_at,now()+interval '2 days') where id in ${tx([input.sourceAssetId,input.clipAssetId])}`;
    await tx`insert into motion_jobs(id,shop_id,source_asset_id,clip_asset_id,mode,brand_version,title,state,plan,frame_plan,analysis_source,request_hash) values (${input.id},${shop.id},${input.sourceAssetId},${input.clipAssetId},'frame',${shop.current_brand_version},${input.title},'review',${tx.json(DEFAULT_PLAN)},${tx.json(frame)},'manual',${hash})`;
    return {id:input.id};
  });
}
export async function ownFrame(userId:string,jobId:string){
  const [job]=await getDb()<{id:string;shop_id:string;source_asset_id:string;clip_asset_id:string;brand_version:number;revision:number;state:string;review_deadline:Date;frame_plan:FramePlan;brand:BrandProfile}[]>`select j.*,p.profile as brand from motion_jobs j join shops s on s.id=j.shop_id join brand_profiles p on p.shop_id=j.shop_id and p.version=j.brand_version where j.id=${jobId}::uuid and j.mode='frame' and s.owner_user_id=${userId}::uuid`;
  if(!job)throw new MediaError('ไม่พบงานจัดกรอบวิดีโอ',404);
  return {...job,frame_plan:parseFrame(job.frame_plan),brand:job.brand as BrandProfile};
}
