import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import { updateActivity } from "@/lib/game-content/repository";
import {
  readScore,
  readString,
  readVerificationStatus,
} from "@/lib/game-content/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireGameContentAccess(request, "EDITOR");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ EDITOR ขึ้นไป" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const activity = await updateActivity(
      id,
      {
        verificationStatus: readVerificationStatus(body.verificationStatus),
        confidenceScore: readScore(body.confidenceScore),
      },
      actor.id,
      readString(body.note, { max: 1_000 })
    );
    if (!activity) {
      return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });
    }
    return NextResponse.json({ activity });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ยืนยันข้อมูลไม่สำเร็จ" },
      { status: 400 }
    );
  }
}

