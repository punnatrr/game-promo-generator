export type MediaKind = 'image' | 'video';
export type Asset = { id: string; name: string; kind: MediaKind; state: string; size_bytes: number; expires_at: string; metadata: { width: number; height: number; duration?: number; contentType: string } | null };
export type MediaJob = { id: string; asset_id: string; state: string; kind: string; error_code: string | null; attempts: number };
export type MediaProject = { id: string; title: string; current_version: number; brand_version: number; asset_ids: string[]; expires_at: string };
export type Library = { assets: Asset[]; jobs: MediaJob[]; projects: MediaProject[]; usage: { limit: number; reserved: number; used: number }; storageAvailable: boolean; limits: { image: number; video: number; retentionDays: number } };
export const FILE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' } as const;
export const STATE_LABELS: Record<string, string> = { uploading: 'รออัปโหลด', queued: 'รอตรวจไฟล์', running: 'กำลังตรวจไฟล์', retry: 'กำลังลองใหม่', ready: 'พร้อมใช้', deleting: 'กำลังคืนพื้นที่', deleted: 'ลบแล้ว', rejected: 'ไฟล์ใช้งานไม่ได้', succeeded: 'เสร็จแล้ว', failed: 'ไม่สำเร็จ', cancelled: 'ยกเลิกแล้ว' };
export class MediaError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MediaError('รูปแบบข้อมูลไม่ถูกต้อง');
  return value as Record<string, unknown>;
}
export function id(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new MediaError('รหัสรายการไม่ถูกต้อง');
  return value;
}
export function textField(value: unknown, limit: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u001f\u007f]/.test(value)) throw new MediaError('ชื่อรายการไม่ถูกต้องหรือยาวเกินไป');
  return value.trim();
}
export function parseUpload(value: unknown) {
  const raw = object(value);
  const name = textField(raw.name, 160);
  if (typeof raw.contentType !== 'string' || !Object.hasOwn(FILE_TYPES, raw.contentType)) throw new MediaError('รองรับ PNG, JPG, WebP, MP4, MOV และ WebM');
  if (!Number.isSafeInteger(raw.size) || (raw.size as number) <= 0) throw new MediaError('ขนาดไฟล์ไม่ถูกต้อง');
  const contentType = raw.contentType as keyof typeof FILE_TYPES;
  return { name, contentType, size: raw.size as number, requestKey: id(raw.requestKey), kind: (contentType.startsWith('image/') ? 'image' : 'video') as MediaKind };
}
export function parseProject(value: unknown) {
  const raw = object(value);
  if (!Number.isSafeInteger(raw.version) || (raw.version as number) < 0) throw new MediaError('เวอร์ชันไม่ถูกต้อง');
  if (!Array.isArray(raw.assetIds) || raw.assetIds.length < 1 || raw.assetIds.length > 10) throw new MediaError('เลือกไฟล์ 1–10 ไฟล์ต่อชุดงาน');
  const assetIds = [...new Set(raw.assetIds.map(id))];
  return { id: id(raw.id), title: textField(raw.title, 100), version: raw.version as number, assetIds };
}
export function bytesLabel(bytes: number) {
  const divisor = bytes < 1024 ? 1 : bytes < 1024 * 1024 ? 1024 : 1024 * 1024;
  const unit = divisor === 1 ? 'B' : divisor === 1024 ? 'KB' : 'MB';
  return `${(bytes / divisor).toLocaleString('th-TH', { maximumFractionDigits: 1 })} ${unit}`;
}
