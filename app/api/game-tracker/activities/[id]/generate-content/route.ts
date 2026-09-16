import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import { generateGameContent } from "@/lib/game-content/content-assistant";
import {
  getActivity,
  saveGeneratedContent,
} from "@/lib/game-content/repository";
import { allowAction } from "@/lib/game-content/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireGameContentAccess(request, "EDITOR");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ EDITOR ขึ้นไป" }, { status: 403 });
  }
  if (
    !allowAction(`generate:${actor.id}`, {
      limit: 10,
      windowMs: 60 * 60 * 1_000,
    })
  ) {
    return NextResponse.json(
      { error: "เกินจำนวนการสร้างคอนเทนต์ที่กำหนด กรุณาลองใหม่ภายหลัง" },
      { status: 429 }
    );
  }
  const { id } = await params;
  const activity = await getActivity(id);
  if (!activity) {
    return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });
  }
  const result = await generateGameContent(activity);
  await saveGeneratedContent(
    id,
    actor.id,
    result.content,
    result.provider,
    result.model
  );
  return NextResponse.json(result);
}

