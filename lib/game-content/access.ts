import type { NextRequest } from "next/server";

import { isConfiguredAdminIdentity } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { getDb, hasDatabaseUrl } from "@/lib/db";

import type { GameContentRole } from "./types";

const ROLE_WEIGHT: Record<GameContentRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
};

export type GameContentActor = {
  id: string;
  email: string;
  displayName: string | null;
  role: GameContentRole;
};

export async function requireGameContentAccess(
  request: NextRequest,
  minimumRole: GameContentRole = "VIEWER"
): Promise<GameContentActor | null> {
  const user = await getCurrentUser(request);
  if (!user) return null;

  if (
    user.role === "admin" ||
    isConfiguredAdminIdentity({
      email: user.email,
    })
  ) {
    return { ...user, role: "ADMIN" };
  }

  if (!hasDatabaseUrl()) return null;

  try {
    const sql = getDb();
    const rows = await sql<Array<{ content_role: GameContentRole }>>`
      select content_role
      from users
      where id = ${user.id}
      limit 1
    `;
    const role = rows[0]?.content_role || "VIEWER";
    if (ROLE_WEIGHT[role] < ROLE_WEIGHT[minimumRole]) return null;

    return { ...user, role };
  } catch {
    return null;
  }
}
