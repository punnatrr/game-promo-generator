import {NextRequest} from 'next/server';
import {body,failure,json,user} from '@/lib/media/http';
import {parseFrameDraft} from '@/lib/frame/model';
import {createFrameDraft} from '@/lib/frame/repository';
import {studio} from '@/lib/motion/repository';
export async function GET(req:NextRequest){try{const account=await user(req);return json(await studio(account.id,'frame'));}catch(error){return failure(error);}}
export async function POST(req:NextRequest){try{const account=await user(req,true);return json(await createFrameDraft(account.id,parseFrameDraft(await body(req))),201);}catch(error){return failure(error);}}
