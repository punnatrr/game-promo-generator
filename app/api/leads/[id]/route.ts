import { NextRequest } from "next/server";
import { leadFailure, leadJson, leadUser } from "@/lib/leads/http";
import { getLead } from "@/lib/leads/repository";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await leadUser(req);
    const { id } = await context.params;
    const result = await getLead(user.id, id);
    return result ? leadJson(result) : leadJson({ error: "ไม่พบ Lead" }, 404);
  } catch (error) {
    return leadFailure(error);
  }
}
