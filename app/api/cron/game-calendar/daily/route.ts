import { notifyCalendarAdmins } from "@/lib/game-calendar/notifications";
import { isAuthorizedCron } from "@/lib/game-content/cron";
import { runDiscovery } from "@/lib/game-content/discovery";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDiscovery("daily");
  if (result.errorCount > 0) {
    await notifyCalendarAdmins({
      type: "BOT_FAILED",
      title: "Game Calendar bot พบข้อผิดพลาด",
      message: `สำเร็จ ${result.sourceCount - result.errorCount} แหล่ง ล้มเหลว ${result.errorCount} แหล่ง`,
    });
  }
  return Response.json(result, {
    status: result.sourceCount > 0 && result.errorCount === result.sourceCount
      ? 503
      : 200,
  });
}
