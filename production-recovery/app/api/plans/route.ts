import { NextResponse } from "next/server";
import { PLAN_ORDER, SUBSCRIPTION_PLANS } from "@/lib/subscription/plans";

export async function GET() {
  return NextResponse.json({
    plans: PLAN_ORDER.map((slug) => SUBSCRIPTION_PLANS[slug]),
  });
}
