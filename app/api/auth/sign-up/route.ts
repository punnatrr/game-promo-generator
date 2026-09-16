import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  createUserWithPassword,
  normalizeEmail,
  setSessionCookie,
  validatePassword,
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
    const displayName = String(body.displayName || "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "กรุณากรอกอีเมลให้ถูกต้อง" },
        { status: 400 }
      );
    }

    if (!validatePassword(password)) {
      return NextResponse.json(
        { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" },
        { status: 400 }
      );
    }

    const user = await createUserWithPassword({
      email,
      password,
      displayName,
    });
    const session = await createSession(user.id);
    const response = NextResponse.json({ user });

    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    if (error instanceof Error && /duplicate key/i.test(error.message)) {
      return NextResponse.json(
        { error: "อีเมลนี้ถูกใช้งานแล้ว" },
        { status: 409 }
      );
    }

    console.error("sign-up error:", error);
    return NextResponse.json(
      { error: "สมัครสมาชิกไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
