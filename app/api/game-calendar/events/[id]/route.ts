import { publicApiRateLimit } from "@/lib/game-calendar/http";
import { getPublicCalendarEvent } from "@/lib/game-calendar/repository";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = publicApiRateLimit(request);
  if (limited) return limited;
  const { id } = await params;
  const event = await getPublicCalendarEvent(id);
  if (!event) {
    return Response.json({ error: "ไม่พบกิจกรรมหรือกิจกรรมยังไม่เผยแพร่" }, { status: 404 });
  }
  return Response.json(
    { event },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
