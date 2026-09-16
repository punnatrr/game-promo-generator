import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import {
  listNotifications,
  markNotificationsRead,
} from "@/lib/notifications/repository";

export async function GET(req: NextRequest) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  return NextResponse.json(await listNotifications(user.id));
}

export async function PATCH(req: NextRequest) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า DATABASE_URL" }, { status: 503 });
  }

  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  await markNotificationsRead({
    userId: user.id,
    notificationId: body.id ? String(body.id) : undefined,
  });

  return NextResponse.json({ updated: true });
}
