import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import { bulkUpdateActivities } from "@/lib/game-content/repository";
import {
  readContentStatus,
  readString,
} from "@/lib/game-content/validation";

export async function POST(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "EDITOR");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ EDITOR ขึ้นไป" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? body.ids
          .map((id: unknown) => readString(id, { max: 100 }))
          .filter(Boolean)
      : [];
    if (ids.length === 0) throw new Error("กรุณาเลือกอย่างน้อย 1 รายการ");
    const status = readContentStatus(body.status);
    const activities = await bulkUpdateActivities(
      ids,
      status,
      actor.id,
      readString(body.note, { max: 1_000 })
    );
    return NextResponse.json({ activities, updated: activities.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "อัปเดตหลายรายการไม่สำเร็จ" },
      { status: 400 }
    );
  }
}

