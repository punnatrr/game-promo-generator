import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import {
  deleteActivity,
  getActivity,
  updateActivity,
} from "@/lib/game-content/repository";
import {
  readActivityType,
  readContentStatus,
  readOptionalDate,
  readScore,
  readString,
  readVerificationStatus,
} from "@/lib/game-content/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const actor = await requireGameContentAccess(request, "VIEWER");
  if (!actor) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
  }
  const { id } = await context.params;
  const activity = await getActivity(id);
  if (!activity) {
    return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });
  }
  return NextResponse.json({ activity });
}

export async function PATCH(request: NextRequest, context: Context) {
  const actor = await requireGameContentAccess(request, "EDITOR");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ EDITOR ขึ้นไป" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const body = await request.json();
    const activity = await updateActivity(
      id,
      {
        ...(body.title !== undefined
          ? { title: readString(body.title, { max: 300, required: true }) }
          : {}),
        ...(body.description !== undefined
          ? { description: readString(body.description, { max: 10_000 }) }
          : {}),
        ...(body.activityType !== undefined
          ? { activityType: readActivityType(body.activityType) }
          : {}),
        ...(body.startDate !== undefined
          ? { startDate: readOptionalDate(body.startDate) }
          : {}),
        ...(body.endDate !== undefined
          ? { endDate: readOptionalDate(body.endDate) }
          : {}),
        ...(body.expectedReleaseDate !== undefined
          ? { expectedReleaseDate: readOptionalDate(body.expectedReleaseDate) }
          : {}),
        ...(body.verificationStatus !== undefined
          ? { verificationStatus: readVerificationStatus(body.verificationStatus) }
          : {}),
        ...(body.status !== undefined
          ? { status: readContentStatus(body.status) }
          : {}),
        ...(body.confidenceScore !== undefined
          ? { confidenceScore: readScore(body.confidenceScore) }
          : {}),
        ...(body.popularityScore !== undefined
          ? { popularityScore: readScore(body.popularityScore) }
          : {}),
        ...(body.monetizationScore !== undefined
          ? { monetizationScore: readScore(body.monetizationScore) }
          : {}),
        ...(body.urgencyScore !== undefined
          ? { urgencyScore: readScore(body.urgencyScore) }
          : {}),
        ...(body.contentDeadline !== undefined
          ? { contentDeadline: readOptionalDate(body.contentDeadline) }
          : {}),
        ...(body.recommendedPublishDate !== undefined
          ? { recommendedPublishDate: readOptionalDate(body.recommendedPublishDate) }
          : {}),
        ...(typeof body.isFeatured === "boolean"
          ? { isFeatured: body.isFeatured }
          : {}),
      },
      actor.id,
      readString(body.note, { max: 1_000 })
    );
    if (!activity) {
      return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });
    }
    return NextResponse.json({ activity });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "แก้ไขกิจกรรมไม่สำเร็จ" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const actor = await requireGameContentAccess(request, "ADMIN");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ ADMIN" }, { status: 403 });
  }
  const { id } = await context.params;
  const deleted = await deleteActivity(id);
  if (!deleted) {
    return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
