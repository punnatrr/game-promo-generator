import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import { importOfficialSocialPost } from "@/lib/game-content/social-import";
import type { ActivityType } from "@/lib/game-content/types";
import {
  readActivityType,
  readOptionalDate,
  readString,
} from "@/lib/game-content/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "ADMIN");
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const activityTypeValue = readString(body.activityType, { max: 50 });
    const publishedAt = readOptionalDate(body.publishedAt);
    if (!publishedAt) throw new Error("กรุณาระบุวันที่เผยแพร่โพสต์");

    const result = await importOfficialSocialPost({
      gameId: readString(body.gameId, { max: 100, required: true }),
      sourceId: readString(body.sourceId, { max: 100, required: true }),
      postUrl: readString(body.postUrl, { max: 2_000, required: true }),
      postText: readString(body.postText, { max: 20_000, required: true }),
      publishedAt,
      activityType: activityTypeValue
        ? (readActivityType(activityTypeValue) as ActivityType)
        : undefined,
    });

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "นำเข้าโพสต์ไม่สำเร็จ",
      },
      { status: 400 }
    );
  }
}
