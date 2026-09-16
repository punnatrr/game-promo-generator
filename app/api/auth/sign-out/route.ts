import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookie,
  deleteSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (hasDatabaseUrl()) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      await deleteSession(token);
    }
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
