import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { hasDatabaseUrl } from "@/lib/db";
import { approvePayment } from "@/lib/payments/repository";

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
    if (!paymentId) {
      return NextResponse.json(
        { error: "กรุณาระบุ paymentId" },
        { status: 400 }
      );
    }

    const result = await approvePayment({
      paymentId,
      adminUserId: admin.id,
    });

    if (!result) {
      return NextResponse.json(
        { error: "ไม่พบ payment ที่รออนุมัติ" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      result,
      message: "อนุมัติแล้ว และเปิด subscription 30 วันเรียบร้อย",
    });
  } catch (error) {
    console.error("approve payment error:", error);
    return NextResponse.json(
      { error: "อนุมัติ payment ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
