import { NextRequest } from "next/server";
import { leadBody, leadFailure, leadJson, leadUser } from "@/lib/leads/http";
import { setLeadSaved } from "@/lib/leads/repository";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await leadUser(req, true);
    const { id } = await context.params;
    const raw = await leadBody(req);
    const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    return leadJson(await setLeadSaved(user.id, id, body.saved === true));
  } catch (error) { return leadFailure(error); }
}
