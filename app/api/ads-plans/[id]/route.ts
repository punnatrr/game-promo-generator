import {NextRequest} from 'next/server';
import {body,failure,json,user} from '@/lib/media/http';
import {acceptPlan} from '@/lib/ads/repository';
export async function POST(req:NextRequest,context:{params:Promise<{id:string}>}){try{const account=await user(req,true);return json(await acceptPlan(account.id,(await context.params).id,await body(req)));}catch(e){return failure(e);}}
