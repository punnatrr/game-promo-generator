import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { hasDatabaseUrl } from "@/lib/db";
import { listAdminUsers } from "@/lib/admin/users-repository";

export async function GET(req: NextRequest) {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json({
        users: [],
        databaseConfigured: false,
      });
    }

    const admin = await requireAdmin(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const search = req.nextUrl.searchParams.get("search") || "";

    return NextResponse.json({
      users: await listAdminUsers({ search }),
      databaseConfigured: true,
    });
  } catch (error) {
    console.error("list admin users error:", error);
    return NextResponse.json(
      { error: "Unable to load users" },
      { status: 500 }
    );
  }
}
