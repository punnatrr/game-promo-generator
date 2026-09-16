import {
  ACTIVITY_TYPES,
  CONTENT_STATUSES,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  type ActivityType,
  type ContentStatus,
  type SourceType,
  type VerificationStatus,
} from "./types";

export function readString(
  value: unknown,
  { max = 500, required = false }: { max?: number; required?: boolean } = {}
) {
  const result = String(value ?? "").trim();
  if (required && !result) throw new Error("กรุณากรอกข้อมูลให้ครบ");
  if (result.length > max) throw new Error(`ข้อมูลยาวเกิน ${max} ตัวอักษร`);
  return result;
}

export function readOptionalDate(value: unknown) {
  const result = readString(value, { max: 40 });
  if (!result) return null;
  const date = new Date(result);
  if (Number.isNaN(date.getTime())) throw new Error("รูปแบบวันที่ไม่ถูกต้อง");
  return date.toISOString();
}

export function readHttpsUrl(value: unknown, required = true) {
  const result = readString(value, { max: 2_000, required });
  if (!result) return "";
  const url = new URL(result);
  if (url.protocol !== "https:") {
    throw new Error("แหล่งข้อมูลต้องเป็น HTTPS");
  }
  return url.toString();
}

export function readActivityType(value: unknown): ActivityType {
  const result = readString(value) as ActivityType;
  if (!ACTIVITY_TYPES.includes(result)) {
    throw new Error("ประเภทกิจกรรมไม่ถูกต้อง");
  }
  return result;
}

export function readVerificationStatus(
  value: unknown
): VerificationStatus {
  const result = readString(value) as VerificationStatus;
  if (!VERIFICATION_STATUSES.includes(result)) {
    throw new Error("สถานะความน่าเชื่อถือไม่ถูกต้อง");
  }
  return result;
}

export function readContentStatus(value: unknown): ContentStatus {
  const result = readString(value) as ContentStatus;
  if (!CONTENT_STATUSES.includes(result)) {
    throw new Error("สถานะงานไม่ถูกต้อง");
  }
  return result;
}

export function readSourceType(value: unknown): SourceType {
  const result = readString(value) as SourceType;
  if (!SOURCE_TYPES.includes(result)) {
    throw new Error("ประเภทแหล่งข้อมูลไม่ถูกต้อง");
  }
  return result;
}

export function readScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new Error("คะแนนต้องอยู่ระหว่าง 0–100");
  }
  return Math.round(number);
}

export function isSafePublicUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".local")
    ) {
      return false;
    }
    if (
      /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
        hostname
      )
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

