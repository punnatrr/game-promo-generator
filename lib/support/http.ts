import {
  MAX_SUPPORT_IMAGES,
  MAX_SUPPORT_IMAGE_BYTES,
  MAX_SUPPORT_UPLOAD_BYTES,
  SupportImageValidationError,
  uploadSupportImage,
  type UploadedSupportImage,
} from "./image-storage";

export class SupportRequestValidationError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function validateSupportText({
  subject,
  body,
  hasImages,
  requireSubject = false,
}: {
  subject?: string;
  body: string;
  hasImages: boolean;
  requireSubject?: boolean;
}) {
  if (requireSubject && (!subject || subject.length > 160)) {
    throw new SupportRequestValidationError("กรุณาระบุหัวข้อไม่เกิน 160 ตัวอักษร");
  }
  if (body.length > 4000) {
    throw new SupportRequestValidationError("ข้อความต้องไม่เกิน 4,000 ตัวอักษร");
  }
  if (!body && !hasImages) {
    throw new SupportRequestValidationError("กรุณาพิมพ์ข้อความหรือแนบรูปอย่างน้อย 1 รูป");
  }
}

export function getSupportImages(form: FormData) {
  const files = form
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length > MAX_SUPPORT_IMAGES) {
    throw new SupportRequestValidationError(`แนบรูปได้สูงสุด ${MAX_SUPPORT_IMAGES} รูป`);
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (files.some((file) => file.size > MAX_SUPPORT_IMAGE_BYTES)) {
    throw new SupportRequestValidationError("ภาพแต่ละไฟล์ต้องมีขนาดไม่เกิน 3 MB", 413);
  }
  if (totalSize > MAX_SUPPORT_UPLOAD_BYTES) {
    throw new SupportRequestValidationError("ขนาดรูปทั้งหมดต้องไม่เกิน 4 MB", 413);
  }

  return files;
}

export async function uploadSupportImages({
  conversationId,
  files,
}: {
  conversationId: string;
  files: File[];
}) {
  const uploaded: UploadedSupportImage[] = [];

  try {
    for (const file of files) {
      uploaded.push(await uploadSupportImage({ conversationId, file }));
    }
    return uploaded;
  } catch (error) {
    if (error instanceof SupportImageValidationError) throw error;
    throw error;
  }
}
