import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import {
  hashTrialCode,
  isValidTrialCode,
  normalizeTrialCode,
} from "@/lib/trial/codes";
import { redeemTrialCodeForUser } from "@/lib/trial/repository";

export async function POST(req: NextRequest) {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่าฐานข้อมูล" },
        { status: 503 }
      );
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อนกรอกโค้ดทดลองใช้" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const code = normalizeTrialCode(String(body.code || ""));

    if (!isValidTrialCode(code)) {
      return NextResponse.json(
        { error: "โค้ดทดลองใช้ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const result = await redeemTrialCodeForUser({
      userId: user.id,
      codeHash: hashTrialCode(code),
    });

    if (result.outcome === "redeemed") {
      return NextResponse.json({
        message: "เปิดสิทธิ์ทดลองใช้ฟรี 10 รูปเรียบร้อยแล้ว",
        subscriptionId: result.subscriptionId,
      });
    }

    if (result.outcome === "already_redeemed") {
      return NextResponse.json(
        { error: "บัญชีนี้เคยรับสิทธิ์ทดลองใช้ฟรีแล้ว" },
        { status: 409 }
      );
    }

    if (result.outcome === "active_subscription") {
      return NextResponse.json(
        { error: "บัญชีนี้มีแพ็กเกจที่กำลังใช้งานอยู่แล้ว" },
        { status: 409 }
      );
    }

    if (result.outcome === "redemption_limit_reached") {
      return NextResponse.json(
        { error: "โค้ดนี้ถูกใช้ครบจำนวนแล้ว" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "โค้ดทดลองใช้ไม่ถูกต้องหรือหมดอายุแล้ว" },
      { status: 404 }
    );
  } catch (error) {
    const databaseError = error as Error & { code?: string };
    if (databaseError.code === "23505") {
      return NextResponse.json(
        { error: "บัญชีนี้เคยรับสิทธิ์ทดลองใช้ฟรีแล้ว" },
        { status: 409 }
      );
    }

    console.error("trial code redemption error:", error);
    return NextResponse.json(
      { error: "เปิดสิทธิ์ทดลองใช้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
