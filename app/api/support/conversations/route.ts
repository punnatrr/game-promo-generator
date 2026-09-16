import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import { getActiveSubscriptionAccessByUserId } from "@/lib/subscription/repository";
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
  createSupportConversation,
  listUserSupportConversations,
} from "@/lib/support/repository";

export const runtime = "nodejs";

async function getVipAccess(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return { user: null, allowed: false, isAdmin: false };

  const isAdmin = isAdminUser(user);
  if (isAdmin) return { user, allowed: true, isAdmin };

  const access = await getActiveSubscriptionAccessByUserId(user.id);
  return {
    user,
    allowed: Boolean(access?.plan.hasVipSupport),
    isAdmin,
  };
}

export async function GET(req: NextRequest) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า DATABASE_URL", databaseConfigured: false },
      { status: 503 }
    );
  }

  const access = await getVipAccess(req);
  if (!access.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  if (!access.allowed) {
    return NextResponse.json(
      {
        error: "VIP Support เปิดให้ใช้งานเฉพาะแพ็ก Business 999",
        access: false,
        conversations: [],
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    access: true,
    conversations: await listUserSupportConversations(access.user.id),
  });
}

export async function POST(req: NextRequest) {
  let uploaded: UploadedSupportImage[] = [];

  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า DATABASE_URL" }, { status: 503 });
    }

    const access = await getVipAccess(req);
    if (!access.user) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    if (!access.allowed) {
      return NextResponse.json(
        { error: "VIP Support เปิดให้ใช้งานเฉพาะแพ็ก Business 999" },
        { status: 403 }
      );
    }

    const form = await req.formData();
    const subject = String(form.get("subject") || "").trim();
    const body = String(form.get("message") || "").trim();
    const files = getSupportImages(form);
    validateSupportText({ subject, body, hasImages: files.length > 0, requireSubject: true });

    const conversationId = randomUUID();
    uploaded = await uploadSupportImages({ conversationId, files });

    await createSupportConversation({
      conversationId,
      userId: access.user.id,
      subject,
      body,
      attachments: uploaded,
    });
    uploaded = [];

    return NextResponse.json({ conversationId }, { status: 201 });
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
    console.error("create support conversation error:", error);
    return NextResponse.json({ error: "เปิดบทสนทนาไม่สำเร็จ" }, { status: 500 });
  }
}
