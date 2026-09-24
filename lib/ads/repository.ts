import {createHash} from 'node:crypto';
import {getDb} from '../db';
import {shopFor} from '../media/repository';
import {MediaError,id,object} from '../media/model';
import type {BrandProfile} from '../brand/model';
import {boundedMedia} from '../frame/resources';
import {aiAvailable,analyzeAd} from './analyze';
import {makePlan,parseBrief,type SavedPlan} from './model';
const month="date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'";
async function recover(userId:string){await getDb()`update ads_plans p set analysis_state='fallback' from shops s where s.id=p.shop_id and s.owner_user_id=${userId}::uuid and p.analysis_state='running' and p.created_at<now()-interval '2 minutes'`;}
export async function listPlans(userId:string){
  await recover(userId);const db=getDb();
  const [entitlement]=await db`select coalesce(e.enabled,false) as enabled,coalesce(e.monthly_limit,0) as limit,(select count(*)::int from ads_plans p where p.shop_id=s.id and p.created_at>=${db.unsafe(month)}) as used from shops s left join ads_entitlements e on e.shop_id=s.id where s.owner_user_id=${userId}::uuid`;
  const plans=await db<SavedPlan[]>`select p.id,p.brief,p.result,p.brand_version,b.profile as brand,p.created_at,p.accepted_at,p.analysis_state,p.review,p.asset_name,coalesce(a.state='ready' and a.expires_at>now(),false) as asset_available from ads_plans p join shops s on s.id=p.shop_id join brand_profiles b on b.shop_id=p.shop_id and b.version=p.brand_version left join media_assets a on a.id=p.asset_id where s.owner_user_id=${userId}::uuid order by p.created_at desc limit 100`;
  return {plans,entitlement:entitlement||{enabled:false,limit:0,used:0},aiAvailable:aiAvailable()};
}
export async function createPlan(userId:string,value:unknown){
  const raw=object(value),planId=id(raw.id),brief=parseBrief(raw.brief);const hash=createHash('sha256').update(JSON.stringify(brief)).digest('hex');
  const prepared=await getDb().begin(async tx=>{
    const shop=await shopFor(tx,userId);
    const [old]=await tx`select request_hash from ads_plans where id=${planId}::uuid and shop_id=${shop.id}`;
    if(old){if(old.request_hash!==hash)throw new MediaError('รหัสคำขอนี้ถูกใช้กับแผนอื่นแล้ว',409);return {created:false,pathname:null as string|null};}
    const [grant]=await tx`select * from ads_entitlements where shop_id=${shop.id}`;
    if(!grant?.enabled)throw new MediaError('บัญชีนี้ยังไม่ได้เปิดสิทธิ์วางแผนโฆษณา',403);
    const [count]=await tx`select count(*) filter(where created_at>=${tx.unsafe(month)})::int as used,count(*) filter(where created_at>now()-interval '1 hour')::int as recent from ads_plans where shop_id=${shop.id}`;
    if(count.used>=grant.monthly_limit)throw new MediaError('ใช้จำนวนแผนของเดือนนี้ครบแล้ว',409);
    if(count.recent>=10)throw new MediaError('สร้างแผนบ่อยเกินไป ลองใหม่ภายหลัง',429);
    if(brief.ai&&!aiAvailable())throw new MediaError('AI วิเคราะห์ยังไม่พร้อม ใช้แผนคำนวณก่อนได้',503);
    let asset:{name:string;pathname:string;kind:string}|undefined;
    if(brief.assetId){[asset]=await tx`select name,pathname,kind from media_assets where id=${brief.assetId}::uuid and shop_id=${shop.id} and state='ready' and expires_at>now() for update`;if(!asset)throw new MediaError('เลือกสื่อที่พร้อมใช้จากคลังของคุณ');}
    const [brand]=await tx<{profile:BrandProfile}[]>`select profile from brand_profiles where shop_id=${shop.id} and version=${shop.current_brand_version}`;
    const result=makePlan(brief,brand.profile);
    await tx`insert into ads_plans (id,shop_id,brand_version,asset_id,asset_name,brief,result,request_hash,analysis_state) values (${planId},${shop.id},${shop.current_brand_version},${brief.assetId},${asset?.name||null},${tx.json(brief)},${tx.json(result)},${hash},${brief.ai?'running':'rules'})`;
    return {created:true,pathname:asset?.kind==='image'?asset.pathname:null};
  });
  if(prepared.created&&brief.ai){
    try{const image=prepared.pathname?await boundedMedia(prepared.pathname,10*1024*1024):undefined;const review=await analyzeAd(brief,image);
      await getDb()`update ads_plans set analysis_state='ai',review=${getDb().json(review)} where id=${planId}::uuid and analysis_state='running'`;
    }catch{await getDb()`update ads_plans set analysis_state='fallback' where id=${planId}::uuid and analysis_state='running'`;}
  }
  return {id:planId};
}
export async function acceptPlan(userId:string,planId:string,value:unknown){
  if(object(value).confirmed!==true)throw new MediaError('กรุณายืนยันว่าได้ตรวจแผนแล้ว');
  await recover(userId);
  const rows=await getDb()`update ads_plans p set accepted_at=coalesce(p.accepted_at,now()) from shops s where p.id=${id(planId)}::uuid and s.id=p.shop_id and s.owner_user_id=${userId}::uuid and p.analysis_state<>'running' returning p.id`;
  if(!rows.length)throw new MediaError('ไม่พบแผนที่พร้อมตรวจรับ',404);return {id:planId};
}
