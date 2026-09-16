import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import { getActiveSubscriptionAccessByUserId } from "@/lib/subscription/repository";
import { getRemainingImages } from "@/lib/subscription/quota";

export async function GET(req: NextRequest) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      user: null,
      subscription: null,
      databaseConfigured: false,
    });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({
      user: null,
      subscription: null,
      databaseConfigured: true,
    });
  }

  const access = await getActiveSubscriptionAccessByUserId(user.id);
  if (!access) {
    return NextResponse.json({
      user,
      subscription: null,
      databaseConfigured: true,
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
  });
}
