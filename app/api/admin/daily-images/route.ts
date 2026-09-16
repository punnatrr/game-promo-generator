import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { hasDatabaseUrl } from "@/lib/db";
import {
  createDailyImage,
  deleteDailyImage,
  listDailyImages,
  type DailyImageSlot,
} from "@/lib/daily-images/repository";
import {
  DailyImageValidationError,
  deleteDailyImageBlob,
  uploadDailyImageBlob,
} from "@/lib/daily-images/storage";

const DAILY_IMAGE_SLOTS: DailyImageSlot[] = ["image1", "image2"];
const MAX_DAILY_IMAGE_DATA_URL_LENGTH = 4_500_000;

function isValidDailyImageSlot(value: string): value is DailyImageSlot {
  return DAILY_IMAGE_SLOTS.includes(value as DailyImageSlot);
}

function isValidImageDataUrl(value: string) {
  return (
    /^data:image\/(png|jpe?g|webp);base64,/i.test(value) &&
    value.length <= MAX_DAILY_IMAGE_DATA_URL_LENGTH
  );
}

export async function GET(req: NextRequest) {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json({
        images: [],
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

    return NextResponse.json({
      images: await listDailyImages({ includeInactive: true }),
      databaseConfigured: true,
    });
  } catch (error) {
    console.error("list daily images error:", error);
    return NextResponse.json(
      { error: "Unable to load daily images" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let uploadedUrl: string | null = null;

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

    const body = await req.json();
    const gameName = String(body.gameName || "").trim();
    const gameTag = String(body.gameTag || "").trim();
    const imageSlot = String(body.imageSlot || "");
    const imageUrl = String(body.imageUrl || "").trim();

    if (!gameName || gameName.length > 80) {
      return NextResponse.json(
        { error: "Game name is required and must be 80 characters or less" },
        { status: 400 }
      );
    }

    if (gameTag.length > 80) {
      return NextResponse.json(
        { error: "Game tag must be 80 characters or less" },
        { status: 400 }
      );
    }

    if (!isValidDailyImageSlot(imageSlot)) {
      return NextResponse.json(
        { error: "Invalid image slot" },
        { status: 400 }
      );
    }

    if (!isValidImageDataUrl(imageUrl)) {
      return NextResponse.json(
        { error: "Daily image must be PNG, JPG, or WEBP and under 4.5 MB" },
        { status: 400 }
      );
    }

    const uploaded = await uploadDailyImageBlob({
      gameName,
      imageDataUrl: imageUrl,
    });
    uploadedUrl = uploaded.url;

    const image = await createDailyImage({
      gameName,
      gameTag,
      imageSlot,
      imageUrl: uploaded.url,
      uploadedByUserId: admin.id,
    });

    uploadedUrl = null;
    return NextResponse.json({ image });
  } catch (error) {
    if (uploadedUrl) await deleteDailyImageBlob(uploadedUrl).catch(console.error);
    if (error instanceof DailyImageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("create daily image error:", error);
    return NextResponse.json(
      { error: "Unable to create daily image" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
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

    const id = req.nextUrl.searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json(
        { error: "Daily image id is required" },
        { status: 400 }
      );
    }

    const deletedImage = await deleteDailyImage(id);
    if (deletedImage?.imageUrl) {
      await deleteDailyImageBlob(deletedImage.imageUrl).catch((error) => {
        console.error("delete daily image blob error:", error);
      });
    }

    return NextResponse.json({ deleted: Boolean(deletedImage) });
  } catch (error) {
    console.error("delete daily image error:", error);
    return NextResponse.json(
      { error: "Unable to delete daily image" },
      { status: 500 }
    );
  }
}
