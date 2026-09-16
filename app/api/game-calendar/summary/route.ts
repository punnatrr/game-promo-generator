import { getCalendarDashboardSummary } from "@/lib/game-calendar/repository";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    {
      summary: await getCalendarDashboardSummary(),
      timezone: "Asia/Bangkok",
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}

