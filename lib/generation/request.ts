import {
  normalizeAspectRatio,
  normalizeImageModel,
  normalizeImageQuality,
  promptAspectRatio,
  type AspectRatio,
  type ImageModel,
  type ImageQuality,
} from "@/lib/generation/config";
import { GenerateError } from "@/lib/generation/errors";
import { generateImage } from "@/lib/generation/service";
import { buildPrompt, buildRefinePrompt } from "@/lib/prompt";

type CommonOptions = {
  model: ImageModel;
  quality: ImageQuality;
  aspectRatio: AspectRatio;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function image(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function commonOptions(formData: FormData): CommonOptions {
  return {
    model: normalizeImageModel(
      text(formData, "aiModel") || process.env.IMAGE_MODEL || ""
    ),
    quality: normalizeImageQuality(
      text(formData, "imageQuality") || process.env.IMAGE_QUALITY || ""
    ),
    aspectRatio: normalizeAspectRatio(text(formData, "aspectRatio") || "1:1"),
  };
}

async function refine(formData: FormData, options: CommonOptions) {
  const generatedImage = image(formData, "generatedImage");
  const editInstruction = text(formData, "editInstruction");

  if (!generatedImage) {
    throw new GenerateError(
      "Missing generated image",
      400,
      "ไม่พบภาพผลลัพธ์เดิมสำหรับแก้ไข"
    );
  }

  if (!editInstruction) {
    throw new GenerateError(
      "Missing edit instruction",
      400,
      "กรุณาระบุคำสั่งที่ต้องการแก้ไขภาพ"
    );
  }

  const result = await generateImage({
    ...options,
    prompt: buildRefinePrompt({
      editInstruction,
      targetShop: text(formData, "targetShop"),
      referenceShop: text(formData, "referenceShop"),
      forbiddenShop: text(formData, "forbiddenShop"),
      aspectRatio: promptAspectRatio(options.aspectRatio),
    }),
    images: [generatedImage],
  });

  if (!result) {
    throw new GenerateError(
      "Provider returned no refined image",
      500,
      "AI ไม่ได้ส่งภาพที่แก้ไขกลับมา"
    );
  }

  return result;
}

async function generate(formData: FormData, options: CommonOptions) {
  const images = ["image1", "image2", "image3"].map((key) =>
    image(formData, key)
  );

  if (images.some((item) => item === null)) {
    throw new GenerateError(
      "Missing reference images",
      400,
      "กรุณาอัปโหลดภาพให้ครบ 3 ภาพ"
    );
  }

  const targetShop = text(formData, "targetShop");
  const referenceShop = text(formData, "referenceShop");
  const forbiddenShop = text(formData, "forbiddenShop");
  const requiredFields = [
    [targetShop, "กรุณากรอกชื่อร้านของเรา"],
    [referenceShop, "กรุณากรอกร้านอ้างอิง Layout"],
    [forbiddenShop, "กรุณากรอกร้านที่ห้ามใช้ UI"],
  ] as const;
  const missingField = requiredFields.find(([value]) => !value);

  if (missingField) {
    throw new GenerateError("Missing shop context", 400, missingField[1]);
  }

  const result = await generateImage({
    ...options,
    prompt: buildPrompt({
      targetShop,
      referenceShop,
      forbiddenShop,
      aspectRatio: promptAspectRatio(options.aspectRatio),
    }),
    images: images as File[],
  });

  if (!result) {
    throw new GenerateError(
      "Provider returned no image",
      500,
      "AI ไม่ได้ส่งภาพกลับมา"
    );
  }

  return result;
}

export async function processGenerationRequest(formData: FormData) {
  const options = commonOptions(formData);
  return text(formData, "mode") === "refine"
    ? refine(formData, options)
    : generate(formData, options);
}
