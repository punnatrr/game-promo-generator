import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";

export async function GET(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "VIEWER");
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ actor });
}
