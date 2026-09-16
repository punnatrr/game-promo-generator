import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import {
  listActivities,
  saveCalendarItem,
} from "@/lib/game-content/repository";
import {
  readOptionalDate,
  readString,
} from "@/lib/game-content/validation";

export async function GET(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "VIEWER");
  if (!actor) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
  }
  const dateFrom = request.nextUrl.searchParams.get("dateFrom") || undefined;
  const dateTo = request.nextUrl.searchParams.get("dateTo") || undefined;
  const activities = await listActivities({ dateFrom, dateTo });
  const calendar = activities.map((activity) => ({
    id: activity.id,
    activityId: activity.id,
    gameName: activity.gameName,
    title: activity.title,
    activityType: activity.activityType,
    announcementDate: activity.announcementDate,
    contentDeadline: activity.contentDeadline,
    recommendedPublishDate: activity.recommendedPublishDate,
    startDate: activity.startDate,
    endDate: activity.endDate,
    status: activity.status,
    priority: activity.contentPriority,
  }));
  return NextResponse.json({ calendar, timezone: "Asia/Bangkok" });
}

export async function POST(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "EDITOR");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ EDITOR ขึ้นไป" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const scheduledAt = readOptionalDate(body.scheduledAt);
    if (!scheduledAt) throw new Error("กรุณาระบุวันลงคอนเทนต์");
    const item = await saveCalendarItem({
      activityId: readString(body.activityId, { max: 100 }) || null,
      calendarType: readString(body.calendarType || "MANUAL", {
        max: 40,
        required: true,
      }),
      scheduledAt,
      postType: readString(body.postType || "Game update", {
        max: 100,
        required: true,
      }),
      status: readString(body.status || "PLANNED", {
        max: 40,
        required: true,
      }),
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "บันทึกปฏิทินไม่สำเร็จ" },
      { status: 400 }
    );
  }
}

