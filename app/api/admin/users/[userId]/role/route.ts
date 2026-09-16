import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { hasDatabaseUrl } from "@/lib/db";
import {
  updateUserRole,
  type AdminUserRole,
} from "@/lib/admin/users-repository";

const ROLES: AdminUserRole[] = ["user", "admin"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        { error: "DATABASE_URL is not configured" },
        { status: 503 }
      );
    }

    const admin = await requireAdmin(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { userId } = await params;
    const body = await req.json();
    const role = String(body.role || "") as AdminUserRole;

    if (!ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (admin.id === userId && role !== "admin") {
      return NextResponse.json(
        { error: "You cannot remove your own admin role here" },
        { status: 400 }
      );
    }

    const user = await updateUserRole({
      adminUserId: admin.id,
      userId,
      role,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("update user role error:", error);
    return NextResponse.json(
      { error: "Unable to update role" },
      { status: 500 }
    );
  }
}
