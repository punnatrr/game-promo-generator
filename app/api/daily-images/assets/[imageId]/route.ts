import { NextRequest, NextResponse } from "next/server";
import { isConfiguredAdminIdentity } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import { getDailyImageSource } from "@/lib/daily-images/repository";
import {
  dailyImageDataUrlToResponse,
  getDailyImageBlob,
  isDailyImageBlobUrl,
} from "@/lib/daily-images/storage";
import { getActiveSubscriptionAccessByUserId } from "@/lib/subscription/repository";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        { error: "DATABASE_URL is not configured" },
        { status: 503 }
      );
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
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
          { error: "LAZYPRO is available for package 499/999 only" },
          { status: 403 }
        );
      }
    }

    const { imageId } = await params;
    const image = await getDailyImageSource({
      id: imageId,
      includeInactive: isAdmin,
    });

    if (!image) {
      return NextResponse.json({ error: "Daily image not found" }, { status: 404 });
    }

    if (image.image_url.startsWith("data:")) {
      return dailyImageDataUrlToResponse(image.image_url);
    }

    if (!isDailyImageBlobUrl(image.image_url)) {
      return NextResponse.redirect(image.image_url);
    }

    const blob = await getDailyImageBlob(
      image.image_url,
      req.headers.get("if-none-match") || undefined
    );
    if (!blob) {
      return NextResponse.json({ error: "Daily image not found" }, { status: 404 });
    }
    if (blob.statusCode === 304) {
      return new Response(null, { status: 304, headers: { ETag: blob.blob.etag } });
    }

    return new Response(blob.stream, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(blob.blob.size),
        "Content-Type": blob.blob.contentType,
        ETag: blob.blob.etag,
      },
    });
  } catch (error) {
    console.error("daily image asset error:", error);
    return NextResponse.json(
      { error: "Unable to load daily image" },
      { status: 500 }
    );
  }
}
