import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import { runDiscovery } from "@/lib/game-content/discovery";
import { allowAction } from "@/lib/game-content/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "ADMIN");
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    !allowAction(`game-calendar-refresh:${actor.id}`, {
      limit: 2,
      windowMs: 15 * 60_000,
    })
  ) {
    return NextResponse.json(
      { error: "กรุณารอ 15 นาทีก่อนตรวจสอบอีกครั้ง" },
      { status: 429 }
    );
  }
  return NextResponse.json(await runDiscovery("manual"));
}
