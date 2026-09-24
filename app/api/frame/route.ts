import {NextRequest} from 'next/server';
import {body,failure,json,user} from '@/lib/media/http';
import {parseFrameDraft} from '@/lib/frame/model';
import {createFrameDraft} from '@/lib/frame/repository';
import {studio} from '@/lib/motion/repository';
import {scheduleMotionWork} from '@/lib/media/dispatch';
export async function GET(req:NextRequest){try{const account=await user(req);const result=await studio(account.id,'frame');if(result.jobs.some(job=>['analyzing','queued','running','retry'].includes(job.state)))scheduleMotionWork(req);return json(result);}catch(error){return failure(error);}}
export async function POST(req:NextRequest){try{const account=await user(req,true);const result=await createFrameDraft(account.id,parseFrameDraft(await body(req)));scheduleMotionWork(req);return json(result,201);}catch(error){return failure(error);}}
