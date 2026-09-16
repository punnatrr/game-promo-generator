import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { brandError, brandJson, brandUser } from "@/lib/brand/http";
import { UUID_PATTERN } from "@/lib/brand/model";
import { readLogo } from "@/lib/brand/repository";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await brandUser(req);
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) return brandJson({ error: "ไม่พบโลโก้" }, 404);
    const pathname = await readLogo(user.id, id);
    if (!pathname) return brandJson({ error: "ไม่พบโลโก้" }, 404);
    const blob = await get(pathname, { access: "private" });
    if (!blob || blob.statusCode !== 200) return brandJson({ error: "ไม่พบโลโก้" }, 404);
    return new Response(blob.stream, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return brandError(error); }
}
