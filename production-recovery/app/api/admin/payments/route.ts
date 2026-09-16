import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { hasDatabaseUrl } from "@/lib/db";
import {
  listAdminPayments,
  type PaymentStatus,
} from "@/lib/payments/repository";

const ALLOWED_STATUSES: PaymentStatus[] = [
  "pending",
  "paid",
  "rejected",
  "refunded",
  "expired",
];

export async function GET(req: NextRequest) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      payments: [],
      databaseConfigured: false,
    });
  }

  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json(
      { error: "ต้องเป็น admin เท่านั้น" },
      { status: 403 }
    );
  }

  const rawStatus = req.nextUrl.searchParams.get("status") || "pending";
  const status = ALLOWED_STATUSES.includes(rawStatus as PaymentStatus)
    ? (rawStatus as PaymentStatus)
    : "pending";

  return NextResponse.json({
    payments: await listAdminPayments({ status }),
    databaseConfigured: true,
  });
}
