import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import {
  createGame,
  deleteGame,
  listGames,
  updateGame,
} from "@/lib/game-content/repository";
import { readHttpsUrl, readString } from "@/lib/game-content/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "VIEWER");
  if (!actor) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง Game Content" }, { status: 403 });
  }
  const includeInactive =
    request.nextUrl.searchParams.get("includeInactive") === "1";
  return NextResponse.json({ games: await listGames(includeInactive) });
}

export async function DELETE(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "ADMIN");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ ADMIN" }, { status: 403 });
  }
  const id = readString(request.nextUrl.searchParams.get("id"), {
    max: 100,
    required: true,
  });
  const deleted = await deleteGame(id);
  if (!deleted) {
    return NextResponse.json({ error: "ไม่พบเกม" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}

export async function POST(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "ADMIN");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ ADMIN" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const slug = readString(body.slug, { max: 80, required: true }).toLowerCase();
    const name = readString(body.name, { max: 120, required: true });
    const iconUrl = body.iconUrl ? readHttpsUrl(body.iconUrl) : null;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error("Slug ต้องเป็นตัวอักษรอังกฤษพิมพ์เล็ก ตัวเลข หรือขีดกลาง");
    }
    const game = await createGame({ slug, name, iconUrl });
    return NextResponse.json({ game }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "เพิ่มเกมไม่สำเร็จ" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "ADMIN");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ ADMIN" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const id = readString(body.id, { max: 100, required: true });
    const game = await updateGame(id, {
      ...(body.name !== undefined
        ? { name: readString(body.name, { max: 120, required: true }) }
        : {}),
      ...(body.iconUrl !== undefined
        ? { iconUrl: body.iconUrl ? readHttpsUrl(body.iconUrl) : null }
        : {}),
      ...(typeof body.isActive === "boolean"
        ? { isActive: body.isActive }
        : {}),
    });
    if (!game) {
      return NextResponse.json({ error: "ไม่พบเกม" }, { status: 404 });
    }
    return NextResponse.json({ game });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "แก้ไขเกมไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
