import {NextRequest} from 'next/server';
import {body,failure,json,user} from '@/lib/media/http';
import {id} from '@/lib/media/model';
import {parseFrameRender} from '@/lib/frame/model';
import {ownFrame} from '@/lib/frame/repository';
import {queueRender,cancelMotion} from '@/lib/motion/repository';
import {DEFAULT_PLAN} from '@/lib/motion/model';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const account=await user(req);const job=await ownFrame(account.id,id((await params).id));return json({id:job.id,brand:job.brand,brandVersion:job.brand_version,frame:job.frame_plan,revision:job.revision,state:job.state,sourceAssetId:job.source_asset_id,clipAssetId:job.clip_asset_id});}catch(error){return failure(error);}}
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const account=await user(req,true);const input=parseFrameRender(await body(req));return json(await queueRender(account.id,id((await params).id),{revision:input.revision,plan:{...DEFAULT_PLAN,duration:input.frame.duration}},input.frame),202);}catch(error){return failure(error);}}
export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const account=await user(req,true);const job=await ownFrame(account.id,id((await params).id));await cancelMotion(account.id,job.id);return json({cancelled:true});}catch(error){return failure(error);}}
