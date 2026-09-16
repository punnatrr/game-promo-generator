import { isAuthorizedCron } from "@/lib/game-content/cron";
import { runDiscovery } from "@/lib/game-content/discovery";
import { buildWeeklyPlan } from "@/lib/game-content/planning";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const discovery = await runDiscovery("weekly");
  const plan = await buildWeeklyPlan({ persist: true });
  return Response.json({ discovery, plan });
}
