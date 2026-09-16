import { listPublicCalendarEvents } from "@/lib/game-calendar/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const days =
    new URL(request.url).searchParams.get("days") === "30" ? 30 : 7;
  return Response.json(
    await listPublicCalendarEvents({
      upcomingDays: days,
      sort: "start_asc",
      limit: 100,
    })
  );
}

