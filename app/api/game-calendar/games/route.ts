import { listCalendarGames } from "@/lib/game-calendar/repository";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    { games: await listCalendarGames() },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}

