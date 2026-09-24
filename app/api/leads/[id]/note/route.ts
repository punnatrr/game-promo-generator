import { NextRequest } from "next/server";
import { leadBody, leadFailure, leadJson, leadUser } from "@/lib/leads/http";
import { addLeadNote } from "@/lib/leads/repository";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await leadUser(req, true);
    const { id } = await context.params;
    const raw = await leadBody(req);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return leadJson({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, 400);
    const body = raw as Record<string, unknown>;
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!note || note.length > 4000) return leadJson({ error: "Note ต้องมี 1–4,000 ตัวอักษร" }, 400);
    return leadJson(await addLeadNote(user.id, id, note), 201);
  } catch (error) {
    return leadFailure(error);
  }
}
