import { publicApiRateLimit } from "@/lib/game-calendar/http";
import { listPublicCalendarEvents } from "@/lib/game-calendar/repository";
import { readCalendarFilters } from "@/lib/game-calendar/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = publicApiRateLimit(request);
  if (limited) return limited;
  try {
    const result = await listPublicCalendarEvents(
      readCalendarFilters(new URL(request.url))
    );
    return Response.json(
      {
        ...result,
        timezone: "Asia/Bangkok",
        generatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
