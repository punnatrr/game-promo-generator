import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import { updateSource } from "@/lib/game-content/repository";
import {
  readScore,
  readSourceType,
  readString,
} from "@/lib/game-content/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireGameContentAccess(request, "ADMIN");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ ADMIN" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const source = await updateSource(id, {
      ...(body.name !== undefined
        ? { name: readString(body.name, { max: 200, required: true }) }
        : {}),
      ...(body.sourceType !== undefined
        ? { sourceType: readSourceType(body.sourceType) }
        : {}),
      ...(body.credibilityScore !== undefined
        ? { credibilityScore: readScore(body.credibilityScore) }
        : {}),
      ...(body.language !== undefined
        ? { language: readString(body.language, { max: 20, required: true }) }
        : {}),
      ...(typeof body.isActive === "boolean"
        ? { isActive: body.isActive }
        : {}),
    });
    if (!source) {
      return NextResponse.json({ error: "ไม่พบแหล่งข้อมูล" }, { status: 404 });
    }
    return NextResponse.json({ source });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "แก้ไขแหล่งข้อมูลไม่สำเร็จ" },
      { status: 400 }
    );
  }
}

