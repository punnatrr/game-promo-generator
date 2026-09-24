import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";

export class LeadHttpError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "LeadHttpError";
  }
}

export function leadJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function leadUser(req: NextRequest, mutation = false) {
  if (!hasDatabaseUrl()) throw new LeadHttpError("ระบบ Lead ยังไม่พร้อมใช้งาน", 503);
  if (
    mutation &&
    (req.headers.get("origin") !== req.nextUrl.origin ||
      req.headers.get("sec-fetch-site") === "cross-site")
  ) {
    throw new LeadHttpError("ไม่อนุญาตคำขอจากเว็บไซต์อื่น", 403);
  }
  const user = await getCurrentUser(req);
  if (!user) throw new LeadHttpError("กรุณาเข้าสู่ระบบก่อนใช้งาน Lead Radar", 401);
  return user;
}

export async function leadBody(req: Request, maxBytes = 32768) {
  const reader = req.body?.getReader();
  if (!reader) throw new LeadHttpError("ไม่พบข้อมูล");
  const parts: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.length;
    if (length > maxBytes) {
      await reader.cancel();
      throw new LeadHttpError("ข้อมูลมีขนาดใหญ่เกินไป", 413);
    }
    parts.push(chunk.value);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown;
  } catch {
    throw new LeadHttpError("รูปแบบข้อมูลไม่ถูกต้อง");
  }
}

export function leadFailure(error: unknown) {
  if (error instanceof LeadHttpError) return leadJson({ error: error.message }, error.status);
  if (error instanceof Error && error.message === "LEAD_NOT_FOUND") {
    return leadJson({ error: "ไม่พบ Lead" }, 404);
  }
  if (error instanceof Error && error.message === "INVALID_LEAD_TEXT") {
    return leadJson({ error: "ข้อความ Lead ต้องมี 1–12,000 ตัวอักษร" }, 400);
  }
  console.error("lead request failed", error instanceof Error ? error.name : "UNAVAILABLE");
  return leadJson({ error: "ระบบ Lead ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่" }, 503);
}
