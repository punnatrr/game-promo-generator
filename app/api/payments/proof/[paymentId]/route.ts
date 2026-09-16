import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import { getPaymentProofBlob } from "@/lib/payments/proof-storage";
import { getPaymentProofForViewer } from "@/lib/payments/repository";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า DATABASE_URL" }, { status: 503 });
  }

  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { paymentId } = await params;
  const proof = await getPaymentProofForViewer({
    paymentId,
    userId: user.id,
    isAdmin: isAdminUser(user),
  });
  if (!proof) return NextResponse.json({ error: "ไม่พบหลักฐาน" }, { status: 404 });

  try {
    const blob = await getPaymentProofBlob(
      proof.proof_image_url,
      req.headers.get("if-none-match") || undefined
    );
    if (!blob) return NextResponse.json({ error: "ไม่พบไฟล์หลักฐาน" }, { status: 404 });

    if (blob.statusCode === 304) {
      return new Response(null, { status: 304, headers: { ETag: blob.blob.etag } });
    }

    return new Response(blob.stream, {
      headers: {
        "Content-Type": proof.content_type || blob.blob.contentType,
        "Content-Length": String(blob.blob.size),
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          proof.original_filename || "payment-proof"
        )}"`,
        "Cache-Control": "private, no-cache",
        ETag: blob.blob.etag,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("payment proof read error:", error);
    return NextResponse.json({ error: "เปิดไฟล์หลักฐานไม่สำเร็จ" }, { status: 500 });
  }
}
