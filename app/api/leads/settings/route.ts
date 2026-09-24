import { NextRequest } from "next/server";
import { leadBody, leadFailure, leadJson, leadUser } from "@/lib/leads/http";
import { getLeadSettings, saveLeadSettings } from "@/lib/leads/repository";

export async function GET(req: NextRequest) {
  try {
    const user = await leadUser(req);
    return leadJson(await getLeadSettings(user.id));
  } catch (error) { return leadFailure(error); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await leadUser(req, true);
    const raw = await leadBody(req);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return leadJson({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, 400);
    const body = raw as Record<string, unknown>;
    const minimumLeadScore = Math.max(0, Math.min(100, Number(body.minimumLeadScore || 0)));
    const duplicateWindowHours = Math.max(1, Math.min(2160, Number(body.duplicateWindowHours || 168)));
    const monitoredGameIds = Array.isArray(body.monitoredGameIds) ? body.monitoredGameIds.filter((v): v is string => typeof v === "string").slice(0, 100) : [];
    const negativeKeywords = Array.isArray(body.negativeKeywords) ? body.negativeKeywords.filter((v): v is string => typeof v === "string" && v.trim()).slice(0, 100) : [];
    return leadJson(await saveLeadSettings(user.id, {
      minimumLeadScore,
      duplicateWindowHours,
      monitoredGameIds,
      negativeKeywords,
      aiLanguage: typeof body.aiLanguage === "string" ? body.aiLanguage.slice(0, 20) : "th",
      defaultReplyTone: typeof body.defaultReplyTone === "string" ? body.defaultReplyTone.slice(0, 40) : "SHORT_FRIENDLY",
    }));
  } catch (error) { return leadFailure(error); }
}
