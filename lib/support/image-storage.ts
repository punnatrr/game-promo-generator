import { del, get, put } from "@vercel/blob";

export const MAX_SUPPORT_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_SUPPORT_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_SUPPORT_IMAGES = 5;

export class SupportImageValidationError extends Error {}

type SupportedImage = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

function detectImageType(bytes: Uint8Array): SupportedImage | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
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

export type UploadedSupportImage = {
  url: string;
  pathname: string;
  contentType: SupportedImage["contentType"];
  sizeBytes: number;
  originalFilename: string;
};

export async function uploadSupportImage({
  conversationId,
  file,
}: {
  conversationId: string;
  file: File;
}): Promise<UploadedSupportImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (bytes.length === 0) {
    throw new SupportImageValidationError("ไฟล์ภาพว่างเปล่า");
  }
  if (bytes.length > MAX_SUPPORT_IMAGE_BYTES) {
    throw new SupportImageValidationError("ภาพแต่ละไฟล์ต้องมีขนาดไม่เกิน 3 MB");
  }

  const detected = detectImageType(bytes);
  if (!detected) {
    throw new SupportImageValidationError("รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP เท่านั้น");
  }

  const blob = await put(
    `support-chat/${conversationId}/${crypto.randomUUID()}.${detected.extension}`,
    Buffer.from(bytes),
    {
      access: "private",
      addRandomSuffix: false,
      contentType: detected.contentType,
    }
  );

  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType: detected.contentType,
    sizeBytes: bytes.length,
    originalFilename: file.name.slice(0, 255),
  };
}

export function getSupportImageBlob(url: string, ifNoneMatch?: string) {
  return get(url, { access: "private", ifNoneMatch });
}

export async function deleteSupportImages(images: UploadedSupportImage[]) {
  if (images.length === 0) return;
  await Promise.all(images.map((image) => del(image.url)));
}
