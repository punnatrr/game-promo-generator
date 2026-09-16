import { NextRequest } from 'next/server';
import { failure, json, user } from '@/lib/media/http';
import { id, MediaError } from '@/lib/media/model';
import { enqueueAsset, ownAsset, uploadPermission } from '@/lib/media/repository';
import { localMedia, writeMedia } from '@/lib/media/storage';
// Test-only filesystem transport. Disabled in production and with any remote DB.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try {
  if (!localMedia()) return json({ error: 'Not found' }, 404);
  const account = await user(req, true); const asset = await ownAsset(account.id, id((await params).id));
  await uploadPermission(account.id, asset.pathname);
  const reader = req.body?.getReader(); if (!reader) throw new MediaError('ไม่พบไฟล์');
  let size = 0; const parts: Uint8Array[] = [];
  while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > Number(asset.size_bytes)) { await reader.cancel(); throw new MediaError('ขนาดไฟล์ไม่ถูกต้อง', 413); } parts.push(chunk.value); }
  if (size !== Number(asset.size_bytes)) throw new MediaError('ขนาดไฟล์ไม่ถูกต้อง');
  await writeMedia(asset.pathname, Buffer.concat(parts), asset.declared_type);
  await enqueueAsset(asset.id, asset.pathname, account.id); return json({ queued: true }, 202);
} catch (error) { return failure(error); } }
