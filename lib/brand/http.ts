import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import { BrandConflictError, BrandValidationError } from "./model";

export function brandJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function brandUser(req: NextRequest, mutation = false) {
  if (mutation && (req.headers.get("origin") !== req.nextUrl.origin || req.headers.get("sec-fetch-site") === "cross-site")) {
    return brandJson({ error: "ไม่สามารถบันทึกจากเว็บไซต์อื่นได้" }, 403);
  }
  if (!hasDatabaseUrl()) return brandJson({ error: "ระบบข้อมูลร้านยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง" }, 503);
  const user = await getCurrentUser(req);
  return user || brandJson({ error: "กรุณาเข้าสู่ระบบก่อนตั้งค่าร้าน" }, 401);
}
export function brandError(error: unknown) {
  if (error instanceof BrandConflictError) return brandJson({ error: error.message }, 409);
  if (error instanceof BrandValidationError || error instanceof SyntaxError) return brandJson({ error: error instanceof BrandValidationError ? error.message : "รูปแบบข้อมูลไม่ถูกต้อง" }, 400);
  // Do not log database parameters, profile contents or storage credentials.
  return brandJson({ error: "ระบบข้อมูลร้านไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง" }, 503);
}
