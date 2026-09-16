import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import { getSupportImageBlob } from "@/lib/support/image-storage";
import { getSupportAttachmentForViewer } from "@/lib/support/repository";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า DATABASE_URL" }, { status: 503 });
  }

  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { attachmentId } = await params;
  const attachment = await getSupportAttachmentForViewer({
    attachmentId,
    userId: user.id,
    isAdmin: isAdminUser(user),
  });
  if (!attachment) return NextResponse.json({ error: "ไม่พบรูปภาพ" }, { status: 404 });

  try {
    const blob = await getSupportImageBlob(
      attachment.image_url,
      req.headers.get("if-none-match") || undefined
    );
    if (!blob) return NextResponse.json({ error: "ไม่พบไฟล์รูปภาพ" }, { status: 404 });

    if (blob.statusCode === 304) {
      return new Response(null, { status: 304, headers: { ETag: blob.blob.etag } });
    }

    return new Response(blob.stream, {
      headers: {
        "Content-Type": attachment.content_type || blob.blob.contentType,
        "Content-Length": String(blob.blob.size),
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          attachment.original_filename || "support-image"
        )}"`,
        "Cache-Control": "private, no-cache",
        ETag: blob.blob.etag,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("support image read error:", error);
    return NextResponse.json({ error: "เปิดรูปภาพไม่สำเร็จ" }, { status: 500 });
  }
}
