import {NextRequest} from 'next/server';
import {body,failure,json,user} from '@/lib/media/http';
import {createPlan,listPlans} from '@/lib/ads/repository';
export const maxDuration=90;
export async function GET(req:NextRequest){try{return json(await listPlans((await user(req)).id));}catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{const account=await user(req,true);return json(await createPlan(account.id,await body(req)),201);}catch(e){return failure(e);}}
