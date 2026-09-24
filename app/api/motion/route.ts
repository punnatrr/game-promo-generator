import { NextRequest } from 'next/server';
import { body,failure,json,user } from '@/lib/media/http';
import { parseDraft } from '@/lib/motion/model';
import { createDraft,studio } from '@/lib/motion/repository';
import { scheduleMotionWork } from '@/lib/media/dispatch';
export async function GET(req:NextRequest) {try {const account=await user(req);const result=await studio(account.id);if(result.jobs.some(job=>['analyzing','queued','running','retry'].includes(job.state)))scheduleMotionWork(req);return json(result);}catch(error){return failure(error);}}
export async function POST(req:NextRequest) {try {const account=await user(req,true);const result=await createDraft(account.id,parseDraft(await body(req)));scheduleMotionWork(req);return json(result,201);}catch(error){return failure(error);}}
