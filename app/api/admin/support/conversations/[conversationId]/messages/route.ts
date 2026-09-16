import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { hasDatabaseUrl } from "@/lib/db";
import {
  deleteSupportImages,
  SupportImageValidationError,
  type UploadedSupportImage,
} from "@/lib/support/image-storage";
import {
  getSupportImages,
  SupportRequestValidationError,
  uploadSupportImages,
  validateSupportText,
} from "@/lib/support/http";
import {
  addSupportMessage,
  getSupportConversationForViewer,
  listSupportMessages,
} from "@/lib/support/repository";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า DATABASE_URL" }, { status: 503 });
  }

  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { conversationId } = await params;
  const result = await listSupportMessages({
    conversationId,
    userId: admin.id,
    isAdmin: true,
  });
  if (!result) return NextResponse.json({ error: "ไม่พบบทสนทนา" }, { status: 404 });

  return NextResponse.json(result);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  let uploaded: UploadedSupportImage[] = [];

  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า DATABASE_URL" }, { status: 503 });
    }

    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const { conversationId } = await params;
    const conversation = await getSupportConversationForViewer({
      conversationId,
      userId: admin.id,
      isAdmin: true,
    });
    if (!conversation) {
      return NextResponse.json({ error: "ไม่พบบทสนทนา" }, { status: 404 });
    }

    const form = await req.formData();
    const body = String(form.get("message") || "").trim();
    const files = getSupportImages(form);
    validateSupportText({ body, hasImages: files.length > 0 });

    uploaded = await uploadSupportImages({ conversationId, files });
    await addSupportMessage({
      conversationId,
      senderUserId: admin.id,
      senderRole: "admin",
      body,
      attachments: uploaded,
    });
    uploaded = [];

    return NextResponse.json({ sent: true }, { status: 201 });
  } catch (error) {
    if (uploaded.length > 0) await deleteSupportImages(uploaded).catch(console.error);
    if (
      error instanceof SupportRequestValidationError ||
      error instanceof SupportImageValidationError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error instanceof SupportRequestValidationError ? error.status : 400 }
      );
    }
    console.error("admin support reply error:", error);
    return NextResponse.json({ error: "ส่งคำตอบไม่สำเร็จ" }, { status: 500 });
  }
}
