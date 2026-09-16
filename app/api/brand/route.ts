import { NextRequest, NextResponse } from "next/server";
import { brandError, brandJson, brandUser } from "@/lib/brand/http";
import { validateBrandSave } from "@/lib/brand/model";
import { readBrand, saveBrand } from "@/lib/brand/repository";

export async function GET(req: NextRequest) {
  try {
    const user = await brandUser(req);
    if (user instanceof NextResponse) return user;
    return brandJson(await readBrand(user.id));
  } catch (error) { return brandError(error); }
}
export async function PUT(req: NextRequest) {
  try {
    const user = await brandUser(req, true);
    if (user instanceof NextResponse) return user;
    // Stream with a hard limit even when Content-Length is absent or incorrect.
    const reader = req.body?.getReader();
    if (!reader) return brandJson({ error: "ไม่พบข้อมูลร้าน" }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 16_384) { await reader.cancel(); return brandJson({ error: "ข้อมูลร้านมีขนาดใหญ่เกินไป" }, 413); }
      chunks.push(value);
    }
    const { profile, version } = validateBrandSave(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    return brandJson(await saveBrand(user.id, profile, version));
  } catch (error) { return brandError(error); }
}
