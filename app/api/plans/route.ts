import { NextResponse } from "next/server";
import { hasDatabaseUrl } from "@/lib/db";
import { listActiveSubscriptionPlans } from "@/lib/subscription/repository";

export async function GET() {
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        plans: [],
        databaseConfigured: false,
        error: "ยังไม่ได้ตั้งค่า DATABASE_URL",
      },
      { status: 503 }
    );
  }

  try {
    return NextResponse.json({
      plans: await listActiveSubscriptionPlans(),
      databaseConfigured: true,
    });
  } catch (error) {
    console.error("plans error:", error);
    return NextResponse.json(
      {
        plans: [],
        databaseConfigured: true,
        error: "โหลดแพ็กเกจไม่สำเร็จ",
      },
      { status: 500 }
    );
  }
}
