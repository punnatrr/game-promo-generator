import { NextRequest } from 'next/server';
import { body,failure,json,user } from '@/lib/media/http';
import { parseDraft } from '@/lib/motion/model';
import { createDraft,studio } from '@/lib/motion/repository';
export async function GET(req:NextRequest) {try {const account=await user(req);return json(await studio(account.id));}catch(error){return failure(error);}}
export async function POST(req:NextRequest) {try {const account=await user(req,true);return json(await createDraft(account.id,parseDraft(await body(req))),201);}catch(error){return failure(error);}}
