import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../auth';
import { hasDatabaseUrl } from '../db';
import { MediaError } from './model';
export function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }); }
export async function user(req: NextRequest, mutation = false) {
  if (mutation && (req.headers.get('origin') !== req.nextUrl.origin || req.headers.get('sec-fetch-site') === 'cross-site')) throw new MediaError('ไม่อนุญาตคำขอจากเว็บไซต์อื่น', 403);
  if (!hasDatabaseUrl()) throw new MediaError('คลังไฟล์ยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง', 503);
  const current = await getCurrentUser(req);
  if (!current) throw new MediaError('กรุณาเข้าสู่ระบบก่อนใช้งานคลังไฟล์', 401);
  return current;
}
export async function body(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new MediaError('ไม่พบข้อมูล');
  const parts: Uint8Array[] = []; let length = 0;
  while (true) { const chunk = await reader.read(); if (chunk.done) break; length += chunk.value.length; if (length > 16384) { await reader.cancel(); throw new MediaError('ข้อมูลมีขนาดใหญ่เกินไป', 413); } parts.push(chunk.value); }
  return JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown;
}
export function failure(error: unknown) {
  if (error instanceof MediaError) return json({ error: error.message }, error.status);
  if (error instanceof SyntaxError) return json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400);
  console.error('media request failed', error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Z0-9_]{1,32}$/.test(error.code) ? error.code : 'UNAVAILABLE');
  return json({ error: 'คลังไฟล์ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่' }, 503);
}
