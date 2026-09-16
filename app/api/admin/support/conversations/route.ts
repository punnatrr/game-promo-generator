import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { hasDatabaseUrl } from "@/lib/db";
import { listAdminSupportConversations } from "@/lib/support/repository";

export async function GET(req: NextRequest) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า DATABASE_URL" }, { status: 503 });
  }

  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  return NextResponse.json({
    conversations: await listAdminSupportConversations(),
  });
}
