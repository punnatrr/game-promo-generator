import { NextRequest } from 'next/server';
import { failure, json, user } from '@/lib/media/http';
import { id } from '@/lib/media/model';
import { deleteAsset, ownAsset } from '@/lib/media/repository';
import { readMedia } from '@/lib/media/storage';
import { byteRange,sliceStream } from '@/lib/media/range';
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try {
  const account = await user(req); const asset = await ownAsset(account.id, id((await params).id));
  if (asset.state !== 'ready' || new Date(asset.expires_at).getTime() <= Date.now()) return json({ error: 'ไฟล์ยังไม่พร้อมหรือหมดอายุแล้ว' }, 404);
  const file = await readMedia(asset.pathname); if (!file) return json({ error: 'ไม่พบไฟล์' }, 404);
  if(req.nextUrl.searchParams.get('inline')==='1'&&asset.kind==='video'){
    const requested=req.headers.get('range');const range=requested?byteRange(requested,file.size):undefined;
    if(requested&&!range){await file.stream.cancel();return new Response(null,{status:416,headers:{'Content-Range':`bytes */${file.size}`,'Cache-Control':'private, no-store'}});}
    return new Response(range?sliceStream(file.stream,range.start,range.end):file.stream,{status:range?206:200,headers:{'Content-Type':asset.metadata.contentType,'Content-Length':String(range?range.end-range.start+1:file.size),'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline',...(range?{'Content-Range':`bytes ${range.start}-${range.end}/${file.size}`}:{})}});
  }
  return new Response(file.stream, { headers: { 'Content-Type': asset.metadata.contentType, 'Content-Length': String(file.size), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `attachment; filename="asset.${asset.pathname.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(asset.name).replace(/'/g, '%27')}` } });
} catch (error) { return failure(error); } }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const account = await user(req, true); await deleteAsset(account.id, id((await params).id)); return json({ queued: true }, 202); } catch (error) { return failure(error); } }
