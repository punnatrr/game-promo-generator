import { listPublicCalendarEvents } from "@/lib/game-calendar/repository";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    await listPublicCalendarEvents({
      communityTrend: true,
      sort: "importance",
      limit: 50,
    })
  );
}

