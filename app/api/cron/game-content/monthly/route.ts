import { isAuthorizedCron } from "@/lib/game-content/cron";
import { buildMonthlyPlan } from "@/lib/game-content/planning";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await buildMonthlyPlan({ persist: true }));
}
