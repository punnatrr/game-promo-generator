import { id, object, textField, MediaError } from '../media/model';
export type Box = { x: number; y: number; width: number; height: number; kind: 'price' | 'visual' };
export type MotionPlan = { duration: 6 | 10 | 15; ratio: '9:16' | '1:1' | '16:9'; effect: 'float' | 'still'; boxes: Box[] };
export const DEFAULT_PLAN: MotionPlan = { duration: 6, ratio: '9:16', effect: 'float', boxes: [] };
export const OUTPUT_RESERVE = 32 * 1024 * 1024;
export const MOTION_LABELS: Record<string,string> = { analyzing: 'กำลังวิเคราะห์ภาพ', review: 'พร้อมตรวจแผน', queued: 'รอสร้างวิดีโอ', running: 'กำลังสร้างวิดีโอ', retry: 'รอลองใหม่', succeeded: 'วิดีโอพร้อมแล้ว', failed: 'สร้างไม่สำเร็จ · คืนโควตาแล้ว', cancelled: 'ยกเลิกแล้ว' };
export type MotionJob = { id: string; title: string; source_asset_id: string; output_asset_id: string | null; state: string; plan: MotionPlan; revision: number; analysis_source: string; error_code: string | null; created_at: string; brand_version: number; output_ready: boolean };
export type Studio = { jobs: MotionJob[]; entitlement: { enabled: boolean; limit: number; used: number; reserved: number }; storageAvailable: boolean };
export function parsePlan(value: unknown): MotionPlan {
  const raw = object(value);
  if (![6,10,15].includes(raw.duration as number) || !['9:16','1:1','16:9'].includes(raw.ratio as string) || !['float','still'].includes(raw.effect as string)) throw new MediaError('การตั้งค่าวิดีโอไม่ถูกต้อง');
  if (!Array.isArray(raw.boxes) || raw.boxes.length > 6) throw new MediaError('ไฮไลต์ได้สูงสุด 6 ตำแหน่ง');
  const boxes = raw.boxes.map(value => {
    const b = object(value);
    for (const key of ['x','y','width','height']) if (typeof b[key] !== 'number' || !Number.isFinite(b[key]) || (b[key] as number) < 0 || (b[key] as number) > 100) throw new MediaError('ตำแหน่งไฮไลต์ไม่ถูกต้อง');
    const { x,y,width,height } = b as unknown as Box;
    if (width < 2 || height < 2 || x+width > 100 || y+height > 100 || !['price','visual'].includes(b.kind as string)) throw new MediaError('กรอบไฮไลต์ต้องอยู่ภายในภาพและมีขนาดอย่างน้อย 2%');
    return { x,y,width,height,kind: b.kind as Box['kind'] };
  });
  return { duration: raw.duration as MotionPlan['duration'], ratio: raw.ratio as MotionPlan['ratio'], effect: raw.effect as MotionPlan['effect'], boxes };
}
export function parseDraft(value: unknown) { const raw = object(value); return { id: id(raw.id), sourceAssetId: id(raw.sourceAssetId), title: textField(raw.title,100) }; }
export function parseRender(value: unknown) { const raw = object(value); if (!Number.isSafeInteger(raw.revision) || Number(raw.revision) < 1 || raw.confirmed !== true) throw new MediaError('กรุณาตรวจแผนและยืนยันก่อนสร้างวิดีโอ'); return { revision: raw.revision as number, plan: parsePlan(raw.plan) }; }
export function dimensions(ratio: MotionPlan['ratio']) { return ratio === '9:16' ? { width: 720,height: 1280 } : ratio === '16:9' ? { width: 1280,height: 720 } : { width: 720,height: 720 }; }
export function fitPoster(width: number,height: number,ratio: MotionPlan['ratio']) {
  const frame = dimensions(ratio); const scale = Math.min(frame.width * .92 / width,frame.height * .92 / height);
  return { ...frame, posterWidth: Math.max(2,Math.floor(width*scale/2)*2),posterHeight: Math.max(2,Math.floor(height*scale/2)*2) };
}
