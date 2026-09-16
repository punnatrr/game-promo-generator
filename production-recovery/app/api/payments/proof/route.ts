import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import {
  assertUserOwnsPayment,
  createPaymentProof,
} from "@/lib/payments/repository";

export async function POST(req: NextRequest) {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า DATABASE_URL" },
        { status: 503 }
      );
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อนส่งหลักฐานการชำระเงิน" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const paymentId = String(body.paymentId || "");
    const proofImageUrl = String(body.proofImageUrl || "").trim();
    const note = String(body.note || "").trim();

    if (!paymentId || !proofImageUrl) {
      return NextResponse.json(
        { error: "กรุณาระบุรายการชำระเงินและลิงก์หลักฐาน" },
        { status: 400 }
      );
    }

    const payment = await assertUserOwnsPayment({
      userId: user.id,
      paymentId,
    });
    if (!payment) {
      return NextResponse.json(
        { error: "ไม่พบรายการชำระเงินนี้" },
        { status: 404 }
      );
    }

    if (payment.status !== "pending") {
      return NextResponse.json(
        { error: "รายการนี้ไม่อยู่ในสถานะรอชำระเงิน" },
        { status: 400 }
      );
    }

    const proof = await createPaymentProof({
      userId: user.id,
      paymentId,
      proofImageUrl,
      note,
    });

    return NextResponse.json({
      proof,
      message: "ส่งหลักฐานแล้ว รอ admin ตรวจสอบใน Phase ถัดไป",
    });
  } catch (error) {
    console.error("payment proof error:", error);
    return NextResponse.json(
      { error: "ส่งหลักฐานไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
