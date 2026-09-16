import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import { listUserPayments } from "@/lib/payments/repository";

export async function GET(req: NextRequest) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      payments: [],
      databaseConfigured: false,
    });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      {
        payments: [],
        databaseConfigured: true,
        error: "กรุณาเข้าสู่ระบบก่อนดูรายการชำระเงิน",
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    payments: await listUserPayments(user.id),
    databaseConfigured: true,
  });
}
