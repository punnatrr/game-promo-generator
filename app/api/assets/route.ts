import { NextRequest } from 'next/server';
import { body, failure, json, user } from '@/lib/media/http';
import { parseUpload } from '@/lib/media/model';
import { createAsset, library } from '@/lib/media/repository';
import { localMedia, storageAvailable } from '@/lib/media/storage';
export async function GET(req: NextRequest) { try { const account = await user(req); return json({ ...await library(account.id), storageAvailable: storageAvailable() }); } catch (error) { return failure(error); } }
export async function POST(req: NextRequest) { try {
  const account = await user(req, true);
  if (!storageAvailable()) return json({ error: 'พื้นที่เก็บไฟล์ยังไม่พร้อม กรุณาลองใหม่ภายหลัง' }, 503);
  return json({ ...await createAsset(account.id, parseUpload(await body(req))), local: localMedia() }, 201);
} catch (error) { return failure(error); } }
