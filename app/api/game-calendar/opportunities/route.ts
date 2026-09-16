import { listPublicCalendarEvents } from "@/lib/game-calendar/repository";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    await listPublicCalendarEvents({
      minOpportunity: 70,
      sort: "opportunity",
      limit: 50,
    })
  );
}

