import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  normalizeEmail,
  setSessionCookie,
  verifyUserCredentials,
} from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า DATABASE_URL" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const email = normalizeEmail(String(body.email || ""));
    const password = String(body.password || "");

    const user = await verifyUserCredentials({ email, password });
    if (!user) {
      return NextResponse.json(
        { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    const session = await createSession(user.id);
    const response = NextResponse.json({ user });

    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    console.error("sign-in error:", error);
    return NextResponse.json(
      { error: "เข้าสู่ระบบไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
