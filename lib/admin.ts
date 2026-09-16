import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";

function parseAllowlist(value: string | undefined) {
  return new Set(
    (value || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isConfiguredAdminIdentity({ email }: { email: string }) {
  const allowedEmails = parseAllowlist(process.env.ADMIN_EMAILS);
  return allowedEmails.has(email.trim().toLowerCase());
}

export function isAdminUser(user: { role: string; email: string }) {
  return user.role === "admin" || isConfiguredAdminIdentity({ email: user.email });
}

export async function requireAdmin(req: NextRequest) {
  const user = await getCurrentUser(req);

  if (
    !user ||
    !isAdminUser(user)
  ) {
    return null;
  }

  return user;
}
