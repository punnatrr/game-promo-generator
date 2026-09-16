import { NextRequest, NextResponse } from "next/server";

import { requireGameContentAccess } from "@/lib/game-content/access";
import {
  createActivity,
  listActivities,
} from "@/lib/game-content/repository";
import type { ActivityFilters, ContentPriority } from "@/lib/game-content/types";
import {
  readActivityType,
  readHttpsUrl,
  readOptionalDate,
  readScore,
  readSourceType,
  readString,
  readVerificationStatus,
} from "@/lib/game-content/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "VIEWER");
  if (!actor) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง Game Content" }, { status: 403 });
  }
  const query = request.nextUrl.searchParams;
  const filters: ActivityFilters = {
    gameId: query.get("gameId") || undefined,
    activityType: (query.get("activityType") || undefined) as ActivityFilters["activityType"],
    priority: (query.get("priority") || undefined) as ContentPriority | undefined,
    verificationStatus: (query.get("verificationStatus") || undefined) as ActivityFilters["verificationStatus"],
    status: (query.get("status") || undefined) as ActivityFilters["status"],
    dateFrom: query.get("dateFrom") || undefined,
    dateTo: query.get("dateTo") || undefined,
    region: query.get("region") || undefined,
    platform: query.get("platform") || undefined,
    highMonetization: query.get("highMonetization") === "1",
    hasOfficialImage: query.get("hasOfficialImage") === "1",
    withoutContent: query.get("withoutContent") === "1",
    view: query.get("view") || undefined,
  };
  return NextResponse.json({ activities: await listActivities(filters) });
}

export async function POST(request: NextRequest) {
  const actor = await requireGameContentAccess(request, "EDITOR");
  if (!actor) {
    return NextResponse.json({ error: "ต้องใช้สิทธิ์ EDITOR ขึ้นไป" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const activity = await createActivity({
      gameId: readString(body.gameId, { max: 100, required: true }),
      title: readString(body.title, { max: 300, required: true }),
      originalTitle: readString(body.originalTitle, { max: 300 }) || null,
      activityType: readActivityType(body.activityType),
      description: readString(body.description, { max: 10_000 }),
      startDate: readOptionalDate(body.startDate),
      endDate: readOptionalDate(body.endDate),
      announcementDate: readOptionalDate(body.announcementDate),
      expectedReleaseDate: readOptionalDate(body.expectedReleaseDate),
      region: readString(body.region || "TH", { max: 30, required: true }),
      platform: readString(body.platform || "ALL", { max: 50, required: true }),
      sourceName: readString(body.sourceName, { max: 200, required: true }),
      sourceUrl: readHttpsUrl(body.sourceUrl),
      sourceType: readSourceType(body.sourceType),
      sourcePublishedAt: readOptionalDate(body.sourcePublishedAt),
      verificationStatus: readVerificationStatus(body.verificationStatus),
      confidenceScore: readScore(body.confidenceScore ?? 0),
      popularityScore: readScore(body.popularityScore ?? 0),
      monetizationScore: readScore(body.monetizationScore ?? 0),
      urgencyScore: readScore(body.urgencyScore ?? 0),
      contentDeadline: readOptionalDate(body.contentDeadline),
      recommendedPublishDate: readOptionalDate(body.recommendedPublishDate),
      thumbnailUrl: body.thumbnailUrl ? readHttpsUrl(body.thumbnailUrl) : null,
      officialImageUrl: body.officialImageUrl
        ? readHttpsUrl(body.officialImageUrl)
        : null,
      tags: Array.isArray(body.tags)
        ? body.tags.map((tag: unknown) => readString(tag, { max: 50 })).filter(Boolean).slice(0, 30)
        : [],
    });
    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "บันทึกกิจกรรมไม่สำเร็จ" },
      { status: 400 }
    );
  }
}

