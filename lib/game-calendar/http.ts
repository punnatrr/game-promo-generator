import { allowAction } from "@/lib/game-content/rate-limit";

export function publicApiRateLimit(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const client = forwarded.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (
    allowAction(`game-calendar-public:${client}`, {
      limit: 180,
      windowMs: 60_000,
    })
  ) {
    return null;
  }
  return Response.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: { "Retry-After": "60" },
    }
  );
}
