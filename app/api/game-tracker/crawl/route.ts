import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import { runDiscovery } from "@/lib/game-content/discovery";
import { allowAction } from "@/lib/game-content/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "ADMIN");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ ADMIN" }, { status: 403 });
  }
  if (
    !allowAction(`crawl:${actor.id}`, {
      limit: 2,
      windowMs: 15 * 60 * 1_000,
    })
  ) {
    return NextResponse.json(
      { error: "สั่งตรวจสอบถี่เกินไป กรุณารอ 15 นาที" },
      { status: 429 }
    );
  }
  return NextResponse.json(await runDiscovery("manual"));
}
