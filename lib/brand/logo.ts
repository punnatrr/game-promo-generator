import sharp from "sharp";
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export async function normalizeBrandLogo(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_LOGO_BYTES) throw new Error("Invalid logo size");
  const metadata = await sharp(bytes, { limitInputPixels: 16_000_000 }).metadata();
  if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error("Invalid logo format");
  return sharp(bytes, { limitInputPixels: 16_000_000 }).rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true }).webp().toBuffer();
}
