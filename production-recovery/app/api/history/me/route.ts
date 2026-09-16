import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import { listUserGenerationHistory } from "@/lib/generations/repository";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      history: [],
      databaseConfigured: false,
    });
  }

  const user = await getCurrentUser(req);

  if (!user) {
    return NextResponse.json(
      {
        history: [],
        databaseConfigured: true,
        error: "กรุณาเข้าสู่ระบบก่อนดูประวัติ",
      },
      { status: 401 }
    );
  }

  const history = await listUserGenerationHistory({
    userId: user.id,
  });

  return NextResponse.json({
    history,
    databaseConfigured: true,
  });
}
