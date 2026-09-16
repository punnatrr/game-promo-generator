import {NextRequest} from 'next/server';
import {body,failure,json,user} from '@/lib/media/http';
import {id} from '@/lib/media/model';
import {ownAsset} from '@/lib/media/repository';
import {ownFrame} from '@/lib/frame/repository';
import {parseFrame} from '@/lib/frame/model';
import {boundedMedia,frameBrand} from '@/lib/frame/resources';
import {frameArtwork} from '@/lib/frame/artwork';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{
  const account=await user(req,true);const job=await ownFrame(account.id,id((await params).id));
  if(job.state!=='review'||new Date(job.review_deadline).getTime()<Date.now())return json({error:'แผนนี้ไม่พร้อมแก้ไข กรุณาสร้างงานใหม่'},409);
  const plan=parseFrame(await body(req));const asset=await ownAsset(account.id,job.source_asset_id);
  if(asset.state!=='ready'||new Date(asset.expires_at).getTime()<=Date.now())return json({error:'ภาพต้นฉบับไม่พร้อมใช้'},409);
  const {brand,logo}=await frameBrand(job.shop_id,job.brand_version,plan.logo);
  const png=await frameArtwork(await boundedMedia(asset.pathname,10*1024*1024,Number(asset.size_bytes)),plan,brand,logo);
  return new Response(new Uint8Array(png),{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(error){return failure(error);}}
