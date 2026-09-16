import { NextRequest, NextResponse } from "next/server";
import { isConfiguredAdminIdentity } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import {
  createAdminSubscriptionAccess,
  getActiveSubscriptionAccessByUserId,
} from "@/lib/subscription/repository";
import { getRemainingImages } from "@/lib/subscription/quota";

export async function GET(req: NextRequest) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      user: null,
      subscription: null,
      databaseConfigured: false,
      isAdmin: false,
    });
  }

  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({
        user: null,
        subscription: null,
        databaseConfigured: true,
        isAdmin: false,
      });
    }

    const isAdmin =
      user.role === "admin" ||
      isConfiguredAdminIdentity({
        email: user.email,
      });

    if (isAdmin) {
      const access = createAdminSubscriptionAccess(user.id);

      return NextResponse.json({
        user,
        subscription: {
          id: "admin",
          status: access.status,
          currentPeriodStart: access.currentPeriodStart,
          currentPeriodEnd: access.currentPeriodEnd,
          usedImagesThisPeriod: access.usedImagesThisPeriod,
          remainingImages: getRemainingImages({
            plan: access.plan,
            usedImagesThisPeriod: access.usedImagesThisPeriod,
          }),
          plan: access.plan,
        },
        databaseConfigured: true,
        isAdmin,
      });
    }

    const access = await getActiveSubscriptionAccessByUserId(user.id);
    if (!access) {
      return NextResponse.json({
        user,
        subscription: null,
        databaseConfigured: true,
        isAdmin,
      });
    }

    return NextResponse.json({
      user,
      subscription: {
        id: access.subscriptionId,
        status: access.status,
        currentPeriodStart: access.currentPeriodStart,
        currentPeriodEnd: access.currentPeriodEnd,
        usedImagesThisPeriod: access.usedImagesThisPeriod,
        remainingImages: getRemainingImages({
          plan: access.plan,
          usedImagesThisPeriod: access.usedImagesThisPeriod,
        }),
        plan: access.plan,
      },
      databaseConfigured: true,
      isAdmin,
    });
  } catch (error) {
    console.error("load subscription state error:", error);

    return NextResponse.json(
      {
        error: "โหลดข้อมูลสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        user: null,
        subscription: null,
        databaseConfigured: true,
        isAdmin: false,
      },
      { status: 503 },
    );
  }
}
