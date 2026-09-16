import { del, get, put } from "@vercel/blob";

// Keep the multipart request safely below Vercel Functions' 4.5 MB body limit.
export const MAX_PAYMENT_PROOF_BYTES = 4 * 1024 * 1024;

export class PaymentProofValidationError extends Error {}

type SupportedProof = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

function detectProofType(bytes: Uint8Array): SupportedProof | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
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

export function validatePaymentProof(bytes: Uint8Array) {
  if (bytes.length === 0) throw new PaymentProofValidationError("ไฟล์หลักฐานว่างเปล่า");
  if (bytes.length > MAX_PAYMENT_PROOF_BYTES) {
    throw new PaymentProofValidationError("ไฟล์หลักฐานต้องมีขนาดไม่เกิน 4 MB");
  }

  const detected = detectProofType(bytes);
  if (!detected) {
    throw new PaymentProofValidationError("รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP เท่านั้น");
  }
  return detected;
}

export async function uploadPaymentProof({
  paymentId,
  file,
}: {
  paymentId: string;
  file: File;
}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = validatePaymentProof(bytes);
  const blob = await put(`payment-proofs/${paymentId}/proof.${detected.extension}`, Buffer.from(bytes), {
    access: "private",
    addRandomSuffix: true,
    contentType: detected.contentType,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType: detected.contentType,
    sizeBytes: bytes.length,
    originalFilename: file.name.slice(0, 255),
  };
}

export function getPaymentProofBlob(url: string, ifNoneMatch?: string) {
  return get(url, { access: "private", ifNoneMatch });
}

export async function deletePaymentProofBlob(url: string | null | undefined) {
  if (!url) return;
  await del(url);
}
