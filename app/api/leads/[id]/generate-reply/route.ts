import { NextRequest } from "next/server";
import { leadBody, leadFailure, leadJson, leadUser } from "@/lib/leads/http";
import { generateLeadReply } from "@/lib/leads/service";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await leadUser(req, true);
    const { id } = await context.params;
    const raw = await leadBody(req);
    const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const tone = typeof body.tone === "string" ? body.tone.slice(0, 40) : "SHORT_FRIENDLY";
    return leadJson(await generateLeadReply({ userId: user.id, leadId: id, tone }), 201);
  } catch (error) {
    return leadFailure(error);
  }
}
