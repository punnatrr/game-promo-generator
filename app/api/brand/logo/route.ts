import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getDb } from "@/lib/db";
import { brandError, brandJson, brandUser } from "@/lib/brand/http";
import { MAX_LOGO_BYTES, normalizeBrandLogo } from "@/lib/brand/logo";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const user = await brandUser(req, true);
    if (user instanceof NextResponse) return user;
    if (!process.env.BLOB_READ_WRITE_TOKEN) return brandJson({ error: "พื้นที่เก็บโลโก้ยังไม่พร้อม คุณบันทึกข้อมูลส่วนอื่นก่อนได้" }, 503);
    const reader = req.body?.getReader();
    if (!reader) return brandJson({ error: "กรุณาเลือกไฟล์โลโก้" }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_LOGO_BYTES) { await reader.cancel(); return brandJson({ error: "โลโก้ต้องมีขนาดไม่เกิน 2 MB" }, 413); }
      chunks.push(value);
    }
    let normalized: Buffer;
    try {
      normalized = await normalizeBrandLogo(Buffer.concat(chunks));
    } catch { return brandJson({ error: "กรุณาใช้ภาพนิ่ง PNG, JPG หรือ WebP ที่เปิดได้ และไม่เกิน 16 ล้านพิกเซล" }, 400); }
    const db = getDb();
    const id = randomUUID();
    const pathname = `brand-logos/${user.id}/${id}.webp`;
    // Register before upload: never leave an untracked object after an ambiguous DB response.
    // Rate limit uses a database lock, shared across function instances.
    const allowed = await db.begin(async (tx) => {
      await tx`select id from users where id = ${user.id}::uuid for update`;
      const [count] = await tx<{ count: number }[]>`select count(*)::int as count from brand_logos where owner_user_id = ${user.id}::uuid and created_at > now() - interval '1 hour'`;
      if (count.count >= 20) return false;
      await tx`insert into brand_logos (id, owner_user_id, blob_pathname) values (${id}::uuid, ${user.id}::uuid, ${pathname})`;
      return true;
    });
    if (!allowed) return brandJson({ error: "อัปโหลดโลโก้บ่อยเกินไป กรุณาลองใหม่ภายหลัง" }, 429);
    await put(pathname, normalized, { access: "private", addRandomSuffix: false, contentType: "image/webp" });
    await db`update brand_logos set ready = true where id = ${id}::uuid and owner_user_id = ${user.id}::uuid`;
    return brandJson({ id }, 201);
  } catch (error) { return brandError(error); }
}
