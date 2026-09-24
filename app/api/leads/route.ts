import { NextRequest } from "next/server";
import { leadBody, leadFailure, leadJson, leadUser } from "@/lib/leads/http";
import { listLeads } from "@/lib/leads/repository";
import { ingestLead } from "@/lib/leads/service";

export async function GET(req: NextRequest) {
  try {
    const user = await leadUser(req);
    const search = req.nextUrl.searchParams;
    return leadJson(await listLeads(user.id, {
      status: search.get("status"),
      gameId: search.get("gameId"),
      intent: search.get("intent"),
      minScore: search.get("minScore") ? Number(search.get("minScore")) : null,
      query: search.get("q"),
      saved: search.has("saved") ? search.get("saved") === "true" : null,
      page: search.get("page") ? Number(search.get("page")) : 1,
      limit: search.get("limit") ? Number(search.get("limit")) : 30,
    }));
  } catch (error) {
    return leadFailure(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await leadUser(req, true);
    const raw = await leadBody(req);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return leadJson({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, 400);
    }
    const body = raw as Record<string, unknown>;
    return leadJson(await ingestLead({
      userId: user.id,
      text: typeof body.text === "string" ? body.text : "",
      sourceType: typeof body.sourceType === "string" ? body.sourceType : "MANUAL",
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
      sourceExternalId: typeof body.sourceExternalId === "string" ? body.sourceExternalId : null,
      authorName: typeof body.authorName === "string" ? body.authorName : null,
    }), 201);
  } catch (error) {
    return leadFailure(error);
  }
}
