import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import {
  createSource,
  listSources,
} from "@/lib/game-content/repository";
import {
  readHttpsUrl,
  readScore,
  readSourceType,
  readString,
} from "@/lib/game-content/validation";

export async function GET(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "VIEWER");
  if (!actor) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
  }
  return NextResponse.json({
    sources: await listSources(request.nextUrl.searchParams.get("gameId") || undefined),
  });
}

export async function POST(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "ADMIN");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ ADMIN" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const source = await createSource({
      gameId: readString(body.gameId, { max: 100, required: true }),
      name: readString(body.name, { max: 200, required: true }),
      url: readHttpsUrl(body.url),
      sourceType: readSourceType(body.sourceType),
      credibilityScore: readScore(body.credibilityScore),
      language: readString(body.language || "th", { max: 20, required: true }),
    });
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "เพิ่มแหล่งข้อมูลไม่สำเร็จ" },
      { status: 400 }
    );
  }
}

