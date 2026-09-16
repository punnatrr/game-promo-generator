import { NextRequest, NextResponse } from "next/server";
import { isConfiguredAdminIdentity } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import { listDailyImages } from "@/lib/daily-images/repository";
import { getActiveSubscriptionAccessByUserId } from "@/lib/subscription/repository";

export async function GET(req: NextRequest) {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json({
        images: [],
        databaseConfigured: false,
      });
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { images: [], databaseConfigured: true, error: "Sign in required" },
        { status: 401 }
      );
    }

    const isAdmin =
      user.role === "admin" ||
      isConfiguredAdminIdentity({
        email: user.email,
      });

    if (!isAdmin) {
      const access = await getActiveSubscriptionAccessByUserId(user.id);

      if (!access?.plan.hasSpecialFeatures) {
        return NextResponse.json(
          {
            images: [],
            databaseConfigured: true,
            error: "LAZYPRO is available for package 499/999 only",
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      images: await listDailyImages(),
      databaseConfigured: true,
    });
  } catch (error) {
    console.error("daily images error:", error);
    return NextResponse.json(
      { error: "Unable to load daily images" },
      { status: 500 }
    );
  }
}
