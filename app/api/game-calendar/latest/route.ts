import { listPublicCalendarEvents } from "@/lib/game-calendar/repository";

export const runtime = "nodejs";

export async function GET() {
  const result = await listPublicCalendarEvents({
    sort: "newest",
    limit: 20,
  });
  return Response.json(result);
}

