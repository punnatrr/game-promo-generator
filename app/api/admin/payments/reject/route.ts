import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { hasDatabaseUrl } from "@/lib/db";
import { normalizeIdempotencyKey } from "@/lib/payments/idempotency";
import { rejectPayment } from "@/lib/payments/repository";

function getErrorDetails(error: unknown) {
  const databaseError = error as Error & {
    code?: string;
    constraint_name?: string;
    detail?: string;
  };

  return {
    name: databaseError?.name || "UnknownError",
    message: databaseError?.message || String(error),
    code: databaseError?.code,
    constraint: databaseError?.constraint_name,
    detail: databaseError?.detail,
    stack: databaseError?.stack,
  };
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  let paymentId = "";

  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า DATABASE_URL" },
        { status: 503 }
      );
    }

    const admin = await requireAdmin(req);
    if (!admin) {
      return NextResponse.json(
        { error: "ต้องเป็น admin เท่านั้น" },
        { status: 403 }
      );
    }

    const body = await req.json();
    paymentId = String(body.paymentId || "");
    const reason = String(body.reason || "").trim();
    const idempotencyKey = normalizeIdempotencyKey(
      req.headers.get("idempotency-key")
    );

    if (!paymentId) {
      return NextResponse.json(
        { error: "กรุณาระบุ paymentId" },
        { status: 400 }
      );
    }

    if (!idempotencyKey) {
      return NextResponse.json(
        { error: "คำขอปฏิเสธไม่มี Idempotency-Key ที่ถูกต้อง" },
        { status: 400 }
      );
    }

    console.info("[admin/payments/reject] started", { requestId, paymentId });

    const result = await rejectPayment({
      paymentId,
      adminUserId: admin.id,
      reason,
      idempotencyKey,
    });

    if (!result) {
      console.warn("[admin/payments/reject] payment not pending", {
        requestId,
        paymentId,
      });
      return NextResponse.json(
        { error: "ไม่พบ payment ที่รออนุมัติ" },
        { status: 404 }
      );
    }

    console.info("[admin/payments/reject] succeeded", {
      requestId,
      paymentId,
      alreadyProcessed: result.alreadyProcessed,
    });

    return NextResponse.json({
      result,
      message: result.alreadyProcessed
        ? "รายการนี้ถูกปฏิเสธไปแล้ว"
        : "ปฏิเสธ payment แล้ว",
    });
  } catch (error) {
    console.error("[admin/payments/reject] failed", {
      requestId,
      paymentId,
      error: getErrorDetails(error),
    });
    return NextResponse.json(
      { error: "ปฏิเสธ payment ไม่สำเร็จ", requestId },
      { status: 500 }
    );
  }
}
