import { del, get, put } from "@vercel/blob";

export const MAX_DAILY_IMAGE_BYTES = 4 * 1024 * 1024;

export class DailyImageValidationError extends Error {}

type SupportedDailyImage = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

function detectDailyImageType(bytes: Uint8Array): SupportedDailyImage | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}

function decodeImageDataUrl(dataUrl: string) {
  const match = /^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=\s]+)$/i.exec(
    dataUrl
  );
  if (!match) {
    throw new DailyImageValidationError(
      "Daily image must be PNG, JPG, or WEBP"
    );
  }

  const bytes = new Uint8Array(
    Buffer.from(match[2].replace(/\s/g, ""), "base64")
  );
  if (bytes.length === 0) {
    throw new DailyImageValidationError("Daily image file is empty");
  }
  if (bytes.length > MAX_DAILY_IMAGE_BYTES) {
    throw new DailyImageValidationError("Daily image must be 4 MB or less");
  }

  const detected = detectDailyImageType(bytes);
  if (!detected) {
    throw new DailyImageValidationError(
      "Daily image must be PNG, JPG, or WEBP"
    );
  }

  return { bytes, detected };
}

function slugifyPathPart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "daily-image"
  );
}

export async function convertDailyImageToWebp(imageDataUrl: string) {
  const { bytes } = decodeImageDataUrl(imageDataUrl);
  const { default: sharp } = await import("sharp");

  try {
    return await sharp(Buffer.from(bytes), { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({
        width: 1024,
        height: 1024,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new DailyImageValidationError(
      "Daily image could not be processed. Use a valid PNG, JPG, or WEBP up to 40 megapixels."
    );
  }
}

export async function uploadDailyImageBlob({
  gameName,
  imageDataUrl,
}: {
  gameName: string;
  imageDataUrl: string;
}) {
  const bytes = await convertDailyImageToWebp(imageDataUrl);
  const pathname = `daily-images/${slugifyPathPart(gameName)}/${crypto.randomUUID()}.webp`;

  const blob = await put(pathname, bytes, {
    access: "private",
    addRandomSuffix: false,
    contentType: "image/webp",
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType: "image/webp",
    sizeBytes: bytes.length,
  };
}

export async function deleteDailyImageBlob(url: string | null | undefined) {
  if (!url || !url.startsWith("https://")) return;
  if (!url.includes(".blob.vercel-storage.com/")) return;

  await del(url);
}

export function getDailyImageBlob(url: string, ifNoneMatch?: string) {
  return get(url, { access: "private", ifNoneMatch });
}

export function isDailyImageBlobUrl(url: string) {
  return url.startsWith("https://") && url.includes(".blob.vercel-storage.com/");
}

export function dailyImageDataUrlToResponse(dataUrl: string) {
  const { bytes, detected } = decodeImageDataUrl(dataUrl);

  return new Response(Buffer.from(bytes), {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Length": String(bytes.length),
      "Content-Type": detected.contentType,
    },
  });
}
