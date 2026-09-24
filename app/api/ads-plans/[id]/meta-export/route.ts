import {NextRequest} from 'next/server';
import {getDb} from '@/lib/db';
import {body,failure,user} from '@/lib/media/http';
import {id,MediaError} from '@/lib/media/model';
import {parseBrief} from '@/lib/ads/model';
import {metaFile,parseMetaSetup,META_TEMPLATE} from '@/lib/ads/meta-export';
export async function POST(req:NextRequest,context:{params:Promise<{id:string}>}){
  try{
    const account=await user(req,true);const planId=id((await context.params).id);
    const [plan]=await getDb()`select p.brief,p.accepted_at,p.analysis_state from ads_plans p join shops s on s.id=p.shop_id where p.id=${planId}::uuid and s.owner_user_id=${account.id}::uuid`;
    if(!plan)throw new MediaError('ไม่พบแผนของคุณ',404);
    if(!plan.accepted_at||plan.analysis_state==='running')throw new MediaError('ตรวจและยืนยันแผนก่อนส่งออก',409);
    const setup=parseMetaSetup(await body(req));const bytes=metaFile(parseBrief(plan.brief),setup);
    return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'text/tab-separated-values; charset=utf-16le','Content-Disposition':`attachment; filename="meta-${planId}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Meta-Template':META_TEMPLATE}});
  }catch(e){return failure(e);}
}
