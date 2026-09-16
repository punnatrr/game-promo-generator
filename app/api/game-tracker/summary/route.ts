import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import { getDashboardSummary } from "@/lib/game-content/repository";

export async function GET(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "VIEWER");
  if (!actor) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
  }
  return NextResponse.json({
    summary: await getDashboardSummary(),
    timezone: "Asia/Bangkok",
  });
}

