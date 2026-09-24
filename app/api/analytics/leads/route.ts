import { NextRequest } from "next/server";
import { leadFailure, leadJson, leadUser } from "@/lib/leads/http";
import { getLeadAnalytics } from "@/lib/leads/repository";

export async function GET(req: NextRequest) {
  try {
    const user = await leadUser(req);
    const days = Number(req.nextUrl.searchParams.get("days") || 30);
    return leadJson(await getLeadAnalytics(user.id, days));
  } catch (error) { return leadFailure(error); }
}
