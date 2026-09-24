import { NextRequest } from "next/server";
import { parseLeadCsv } from "@/lib/leads/csv";
import { leadBody, leadFailure, leadJson, leadUser } from "@/lib/leads/http";
import { createLeadImportJob, finishLeadImportJob } from "@/lib/leads/repository";
import { ingestLead } from "@/lib/leads/service";

export async function POST(req: NextRequest) {
  let jobId: string | null = null;
  try {
    const user = await leadUser(req, true);
    const raw = await leadBody(req, 1_500_000);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return leadJson({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, 400);
    }
    const csv = typeof (raw as Record<string, unknown>).csv === "string"
      ? String((raw as Record<string, unknown>).csv)
      : "";
    if (!csv.trim()) return leadJson({ error: "ไม่พบข้อมูล CSV" }, 400);

    const job = await createLeadImportJob(user.id);
    jobId = job.id;
    const rows = parseLeadCsv(csv).slice(0, 1000);
    const counts = { imported: 0, duplicate: 0, invalid: 0, failed: 0 };

    for (const row of rows) {
      if (!row.text.trim()) {
        counts.invalid += 1;
        continue;
      }
      try {
        const result = await ingestLead({
          userId: user.id,
          text: row.text,
          sourceType: row.source || "CSV",
          sourceUrl: row.source_url || null,
          authorName: row.author || null,
        });
        if (result.duplicate) counts.duplicate += 1;
        else counts.imported += 1;
      } catch {
        counts.failed += 1;
      }
    }

    return leadJson(await finishLeadImportJob(user.id, job.id, counts), 201);
  } catch (error) {
    if (jobId) {
      try {
        const user = await leadUser(req);
        await finishLeadImportJob(user.id, jobId, { imported: 0, duplicate: 0, invalid: 0, failed: 1 }, "IMPORT_FAILED");
      } catch {}
    }
    if (error instanceof Error && error.message === "CSV_MISSING_TEXT") {
      return leadJson({ error: "CSV ต้องมีคอลัมน์ text" }, 400);
    }
    if (error instanceof Error && error.message === "CSV_INVALID_COLUMN") {
      return leadJson({ error: "CSV มีคอลัมน์ที่ระบบไม่รองรับ" }, 400);
    }
    return leadFailure(error);
  }
}
