import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import { getManualPaymentConfig, isManualPaymentMethod } from "@/lib/payments/config";
import { createManualPaymentRequest } from "@/lib/payments/repository";
import { getSubscriptionPlan } from "@/lib/subscription/plans";

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
        { error: "กรุณาเข้าสู่ระบบก่อนชำระเงิน" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const planSlug = String(body.planSlug || "");
    const method = String(body.method || "");

    if (!getSubscriptionPlan(planSlug)) {
      return NextResponse.json(
        { error: "ไม่พบแพ็กเกจที่เลือก" },
        { status: 400 }
      );
    }

    if (!isManualPaymentMethod(method)) {
      return NextResponse.json(
        { error: "ช่องทางชำระเงินไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const payment = await createManualPaymentRequest({
      userId: user.id,
      planSlug,
      method,
    });

    if (!payment) {
      return NextResponse.json(
        { error: "ไม่พบแพ็กเกจที่เปิดใช้งานในฐานข้อมูล" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      payment,
      instructions: getManualPaymentConfig(),
    });
  } catch (error) {
    console.error("create payment error:", error);
    return NextResponse.json(
      { error: "สร้างรายการชำระเงินไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
