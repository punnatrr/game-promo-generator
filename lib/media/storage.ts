import { get, del, put } from '@vercel/blob';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export function localMedia() {
  if (process.env.MEDIA_TEST_STORAGE !== '1' || process.env.NODE_ENV === 'production') return false;
  try { return ['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL || '').hostname); } catch { return false; }
}
export function storageAvailable() { return localMedia() || Boolean(process.env.BLOB_READ_WRITE_TOKEN); }
function localPath(key: string) {
  if (!/^media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp|mp4|mov|webm)$/.test(key)) throw new Error('Invalid storage path');
  return path.join(process.cwd(), '.test-build', 'media-store', key);
}
export async function writeMedia(key: string, bytes: Buffer, contentType: string) {
  if (localMedia()) { const filename = localPath(key); await mkdir(path.dirname(filename), { recursive: true }); await writeFile(filename, bytes, { flag: 'wx' }); return; }
  await put(key, bytes, { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType, abortSignal: AbortSignal.timeout(60_000) });
}
export async function readMedia(key: string) {
  if (localMedia()) {
    try { const bytes = await readFile(localPath(key)); return { size: bytes.length, stream: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close(); } }) }; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  const response = await get(key, { access: 'private', useCache: false, abortSignal: AbortSignal.timeout(60_000) });
  return response?.statusCode === 200 ? { size: response.blob.size, stream: response.stream } : null;
}
export async function deleteMedia(key: string) {
  if (localMedia()) { try { await unlink(localPath(key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } return; }
  await del(key);
}
