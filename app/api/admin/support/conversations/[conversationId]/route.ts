import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { hasDatabaseUrl } from "@/lib/db";
import {
  updateSupportConversationStatus,
  type SupportConversationStatus,
} from "@/lib/support/repository";

const STATUSES: SupportConversationStatus[] = ["open", "in_progress", "resolved"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า DATABASE_URL" }, { status: 503 });
  }

  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json();
  const status = String(body.status || "") as SupportConversationStatus;
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  }

  const { conversationId } = await params;
  const conversation = await updateSupportConversationStatus({
    conversationId,
    status,
    adminUserId: admin.id,
  });
  if (!conversation) return NextResponse.json({ error: "ไม่พบบทสนทนา" }, { status: 404 });

  return NextResponse.json({ status });
}
