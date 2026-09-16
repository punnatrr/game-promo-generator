import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import { buildWeeklyPlan } from "@/lib/game-content/planning";

export async function POST(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "EDITOR");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ EDITOR ขึ้นไป" }, { status: 403 });
  }
  return NextResponse.json(await buildWeeklyPlan({ persist: true }));
}

