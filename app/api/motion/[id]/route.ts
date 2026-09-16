import { NextRequest } from 'next/server';
import { body,failure,json,user } from '@/lib/media/http';
import { id } from '@/lib/media/model';
import { parseRender } from '@/lib/motion/model';
import { queueRender,cancelMotion } from '@/lib/motion/repository';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {try {const account=await user(req,true);return json(await queueRender(account.id,id((await params).id),parseRender(await body(req))),202);}catch(error){return failure(error);}}
export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}) {try {const account=await user(req,true);await cancelMotion(account.id,id((await params).id));return json({cancelled:true});}catch(error){return failure(error);}}
