import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { hasDatabaseUrl } from "@/lib/db";
import { rejectPayment } from "@/lib/payments/repository";

export async function POST(req: NextRequest) {
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
    const paymentId = String(body.paymentId || "");
    const reason = String(body.reason || "").trim();

    if (!paymentId) {
      return NextResponse.json(
        { error: "กรุณาระบุ paymentId" },
        { status: 400 }
      );
    }

    const result = await rejectPayment({
      paymentId,
      adminUserId: admin.id,
      reason,
    });

    if (!result) {
      return NextResponse.json(
        { error: "ไม่พบ payment ที่รออนุมัติ" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      result,
      message: "ปฏิเสธ payment แล้ว",
    });
  } catch (error) {
    console.error("reject payment error:", error);
    return NextResponse.json(
      { error: "ปฏิเสธ payment ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
