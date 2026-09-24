import { NextRequest } from "next/server";
import { leadBody, leadFailure, leadJson, leadUser } from "@/lib/leads/http";
import { updateLeadStatus } from "@/lib/leads/repository";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads/types";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await leadUser(req, true);
    const { id } = await context.params;
    const raw = await leadBody(req);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return leadJson({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, 400);
    const body = raw as Record<string, unknown>;
    const status = String(body.status || "") as LeadStatus;
    if (!LEAD_STATUSES.includes(status)) return leadJson({ error: "สถานะไม่ถูกต้อง" }, 400);
    const followUpAt = typeof body.followUpAt === "string" ? body.followUpAt : null;
    const followUpNote = typeof body.followUpNote === "string" ? body.followUpNote.slice(0, 1000) : null;
    return leadJson(await updateLeadStatus(user.id, id, status, followUpAt, followUpNote));
  } catch (error) {
    return leadFailure(error);
  }
}
