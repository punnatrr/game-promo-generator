import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import { listCrawlerRuns } from "@/lib/game-content/repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "VIEWER");
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") || 20);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 20;
  return NextResponse.json({
    runs: await listCrawlerRuns(limit),
    nextRun: "07:00 Asia/Bangkok",
  });
}
