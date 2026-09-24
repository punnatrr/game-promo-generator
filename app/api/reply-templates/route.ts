import { NextRequest } from "next/server";
import { leadBody, leadFailure, leadJson, leadUser } from "@/lib/leads/http";
import { createReplyTemplate, listReplyTemplates } from "@/lib/leads/repository";

export async function GET(req: NextRequest) {
  try {
    const user = await leadUser(req);
    return leadJson({ templates: await listReplyTemplates(user.id) });
  } catch (error) { return leadFailure(error); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await leadUser(req, true);
    const raw = await leadBody(req);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return leadJson({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, 400);
    const body = raw as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!name || name.length > 120 || !content || content.length > 4000) return leadJson({ error: "ชื่อหรือข้อความ Template ไม่ถูกต้อง" }, 400);
    return leadJson(await createReplyTemplate(user.id, {
      name,
      gameId: typeof body.gameId === "string" && body.gameId ? body.gameId : null,
      intent: typeof body.intent === "string" && body.intent ? body.intent : null,
      content,
    }), 201);
  } catch (error) { return leadFailure(error); }
}
