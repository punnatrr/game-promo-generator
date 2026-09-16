import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { failure,json,user } from '@/lib/media/http';
import { id } from '@/lib/media/model';
import { ownAsset } from '@/lib/media/repository';
import { readMedia } from '@/lib/media/storage';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}) {try {
  const account=await user(req);const asset=await ownAsset(account.id,id((await params).id));
  if(asset.kind!=='image'||asset.state!=='ready'||new Date(asset.expires_at).getTime()<=Date.now())return json({error:'ภาพยังไม่พร้อมหรือหมดอายุ'},404);
  const file=await readMedia(asset.pathname);if(!file||file.size>10*1024*1024){await file?.stream.cancel();return json({error:'ไม่พบภาพ'},404);}
  const reader=file.stream.getReader();const parts:Uint8Array[]=[];let size=0;
  const timer=setTimeout(()=>{void reader.cancel();},60_000);
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>file.size){await reader.cancel();throw new Error('size');}parts.push(part.value);}}finally{clearTimeout(timer);}
  if(size!==file.size)throw new Error('size');
  const output=await sharp(Buffer.concat(parts),{limitInputPixels:40_000_000}).rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).png().toBuffer();
  return new Response(new Uint8Array(output),{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(error){return failure(error);}}
