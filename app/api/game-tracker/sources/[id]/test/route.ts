import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import { testDiscoverySource } from "@/lib/game-content/discovery";
import { allowAction } from "@/lib/game-content/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireGameContentAccess(request, "ADMIN");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ ADMIN" }, { status: 403 });
  }
  if (
    !allowAction(`source-test:${actor.id}`, {
      limit: 10,
      windowMs: 15 * 60_000,
    })
  ) {
    return NextResponse.json(
      { error: "ทดสอบถี่เกินไป กรุณารอสักครู่" },
      { status: 429 }
    );
  }
  try {
    const { id } = await params;
    return NextResponse.json({
      result: await testDiscoverySource(id),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ทดสอบ Source ไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
