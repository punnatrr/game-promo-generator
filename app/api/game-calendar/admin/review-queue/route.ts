import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import { listActivities } from "@/lib/game-content/repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "VIEWER");
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const activities = (await listActivities()).filter((activity) =>
    ["DISCOVERED", "REVIEWING"].includes(activity.status)
  );
  return NextResponse.json({
    items: activities,
    total: activities.length,
  });
}
