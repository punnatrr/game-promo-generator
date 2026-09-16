import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function requireAdmin(req: NextRequest) {
  const user = await getCurrentUser(req);

  if (!user || user.role !== "admin") {
    return null;
  }

  return user;
}
