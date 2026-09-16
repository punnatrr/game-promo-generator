import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { isConfiguredAdminIdentity } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { recordGenerationHistory } from "@/lib/generations/repository";
import {
  buildPrompt,
  buildRefinePrompt,
  type SpecialFeaturePrompt,
  type SpecialFeatureStyle,
} from "@/lib/prompt";
import {
  canUseDatabaseBackedSubscriptions,
  createAdminSubscriptionAccess,
  getActiveSubscriptionAccessByUserId,
  recordUsageEvent,
  type ActiveSubscriptionAccess,
} from "@/lib/subscription/repository";
import {
  checkImageQuota,
  countSuccessfulGeneratedImages,
} from "@/lib/subscription/quota";

export const runtime = "nodejs";
export const maxDuration = 300;

type GeminiImageModel = "gemini-3-pro-image-preview";
type OpenAIImageModel = "gpt-image-1.5" | "gpt-image-2" | "gpt-image-3";
type ImageModel = GeminiImageModel | OpenAIImageModel;
type ImageQuality = "low" | "medium" | "high";
type OutputCount = 1 | 2 | 3 | 4 | 5;
type AspectRatio = "1:1" | "3:4" | "4:5" | "9:16" | "4:3" | "16:9";
type ImageResult = {
  mimeType: string;
  data: string;
};
type GeminiImagePart = {
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
};
type GeminiImageResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiImagePart[];
    };
  }>;
};

class GenerateError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly clientMessage?: string
  ) {
    super(message);
    this.name = "GenerateError";
  }
}

const DEFAULT_IMAGE_MODEL: OpenAIImageModel = "gpt-image-1.5";
const DEFAULT_IMAGE_QUALITY: ImageQuality = "medium";
const GEMINI_MODEL: GeminiImageModel = "gemini-3-pro-image-preview";
const OPENAI_IMAGE_MODELS = new Set<OpenAIImageModel>([
  "gpt-image-1.5",
  "gpt-image-2",
  "gpt-image-3",
]);

let googleAI: GoogleGenAI | null = null;

function getGoogleAI() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  if (!googleAI) {
    googleAI = new GoogleGenAI({ apiKey });
  }

  return googleAI;
}

async function fileToPart(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    inlineData: {
      mimeType: file.type,
      data: buffer.toString("base64"),
    },
  };
}

function extractImageData(response: GeminiImageResponse): ImageResult | null {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];

  const imagePart = parts.find((part) => part.inlineData?.data);

  if (!imagePart?.inlineData?.data) return null;

  return {
    mimeType: imagePart.inlineData.mimeType || "image/png",
    data: imagePart.inlineData.data,
  };
}

function normalizeAspectRatio(value: string) {
  const allowed: AspectRatio[] = ["1:1", "3:4", "4:5", "9:16", "4:3", "16:9"];
  return allowed.includes(value as AspectRatio) ? (value as AspectRatio) : "1:1";
}

function normalizeImageModel(value: string): ImageModel {
  if (OPENAI_IMAGE_MODELS.has(value as OpenAIImageModel)) {
    return value as OpenAIImageModel;
  }

  return DEFAULT_IMAGE_MODEL;
}

function normalizeImageQuality(value: string): ImageQuality {
  const allowed: ImageQuality[] = ["low", "medium", "high"];
  return allowed.includes(value as ImageQuality)
    ? (value as ImageQuality)
    : DEFAULT_IMAGE_QUALITY;
}

function normalizeSpecialFeatureStyles(
  values: FormDataEntryValue[]
): SpecialFeatureStyle[] {
  const allowed: SpecialFeatureStyle[] = [
    "brand-colors",
    "brand-layout",
    "logo-qr",
    "full-brand",
  ];
  const allowedSet = new Set<SpecialFeatureStyle>(allowed);
  const styles = values
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter((value): value is SpecialFeatureStyle =>
      allowedSet.has(value as SpecialFeatureStyle)
    );
  const uniqueStyles = Array.from(new Set(styles));

  return uniqueStyles.length > 0 ? uniqueStyles : ["full-brand"];
}

function normalizeOutputCount(value: string): OutputCount {
  const parsed = Number(value);

  return parsed === 2 || parsed === 3 || parsed === 4 || parsed === 5
    ? parsed
    : 1;
}

function imageSizeFromAspectRatio(aspectRatio: string) {
  return aspectRatio === "1:1" ? "1024x1024" : "auto";
}

function geminiAspectRatioFromSelection(aspectRatio: string) {
  if (aspectRatio === "4:5") {
    return "3:4";
  }

  return aspectRatio;
}

function isSafetyError(error: unknown) {
  return error instanceof Error && /safety system|safety/i.test(error.message);
}

function promptAspectRatioFromSelection(aspectRatio: string) {
  const prompts: Record<AspectRatio, string> = {
    "1:1":
      "1:1 square post composition. Design the artwork to fit a square canvas from the start: balanced centered layout, all text/logos/product cards fully inside the safe area, no crop, no stretching, no letterboxing, no padding, no blurred background, no mirror-edge extension.",
    "3:4":
      "Exact 3:4 portrait post composition, like a 1086x1448 px vertical poster. Design the artwork to fit this canvas from the start: full-frame edge-to-edge layout, all text/logos/product cards fully inside the safe area, no crop, no stretching, no letterboxing, no padding, no blurred background, no mirror-edge extension.",
    "4:5":
      "Exact 4:5 Facebook portrait post composition, target 960x1200 px. Design the artwork to fit this canvas from the start: full-frame edge-to-edge Facebook feed layout, key product cards and Thai promo text arranged for mobile feed readability, all text/logos/product cards fully inside the safe area, no crop, no stretching, no letterboxing, no padding, no blurred background, no mirror-edge extension.",
    "9:16":
      "9:16 vertical story composition. Design the artwork to fit a tall story/reel canvas from the start: full-frame edge-to-edge layout, key characters and price cards stacked for vertical viewing, all text/logos/product cards fully inside the safe area, no crop, no stretching, no letterboxing, no padding, no blurred background, no mirror-edge extension.",
    "4:3":
      "4:3 landscape post composition. Design the artwork to fit a horizontal 4:3 canvas from the start: balanced left-right layout, all text/logos/product cards fully inside the safe area, no crop, no stretching, no letterboxing, no padding, no blurred background, no mirror-edge extension.",
    "16:9":
      "16:9 wide banner composition. Design the artwork to fit a wide banner canvas from the start: panoramic full-frame layout, all text/logos/product cards fully inside the safe area, no crop, no stretching, no letterboxing, no padding, no blurred background, no mirror-edge extension.",
  };

  if (aspectRatio in prompts) {
    return prompts[aspectRatio as AspectRatio];
  }

  return aspectRatio;
}

function isOpenAIModel(model: ImageModel): model is OpenAIImageModel {
  return OPENAI_IMAGE_MODELS.has(model as OpenAIImageModel);
}

async function generateWithGemini({
  prompt,
  images,
  aspectRatio,
}: {
  prompt: string;
  images: File[];
  aspectRatio: string;
}) {
  const response = await getGoogleAI().models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...(await Promise.all(images.map((image) => fileToPart(image)))),
        ],
      },
    ],
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: geminiAspectRatioFromSelection(aspectRatio),
      },
    },
  });

  return extractImageData(response);
}

async function generateWithOpenAI({
  model,
  prompt,
  images,
  aspectRatio,
  quality,
}: {
  model: OpenAIImageModel;
  prompt: string;
  images: File[];
  aspectRatio: string;
  quality: ImageQuality;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  if (!apiKey.startsWith("sk-")) {
    throw new Error("Invalid OPENAI_API_KEY");
  }

  const body = new FormData();
  body.append("model", model);
  body.append("prompt", prompt);
  body.append("quality", quality);
  body.append("size", imageSizeFromAspectRatio(aspectRatio));
  body.append("output_format", "png");

  const imageFieldName = images.length > 1 ? "image[]" : "image";

  for (const image of images) {
    body.append(imageFieldName, image, image.name || "reference.png");
  }

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const openAIMessage =
      typeof data?.error?.message === "string" ? data.error.message : "";
    const openAICode =
      data?.error?.code === undefined ? "" : String(data.error.code);
    const status = response.status >= 400 ? response.status : 500;

    if (
      response.status === 429 ||
      /quota|rate limit|billing|spending/i.test(openAIMessage)
    ) {
      throw new GenerateError(
        `OpenAI quota/rate limit reached: ${openAIMessage || openAICode}`,
        429,
        "โควตา/เครดิต OpenAI ไม่พอ หรือชน spending limit แล้ว กรุณาเติมเครดิตหรือเพิ่ม usage limit ใน OpenAI Platform แล้วลองใหม่"
      );
    }

    if (/verification|verify|verified/i.test(openAIMessage)) {
      throw new GenerateError(
        `OpenAI organization verification required: ${
          openAIMessage || openAICode
        }`,
        status,
        "บัญชี/องค์กร OpenAI ยังไม่ได้ผ่าน API Organization Verification สำหรับใช้งาน GPT Image กรุณา verify ใน OpenAI Platform แล้วลองใหม่"
      );
    }

    if (/safety system|safety/i.test(openAIMessage)) {
      throw new GenerateError(
        `OpenAI safety rejected request: ${openAIMessage || openAICode}`,
        status,
        "OpenAI ปฏิเสธภาพนี้ด้วยระบบ safety อาจเกิดจากภาพอ้างอิงหรือเนื้อหาในเกมที่ถูกมองว่าเสี่ยง ระบบจะลองใช้ Gemini แทนถ้าตั้งค่า GEMINI_API_KEY ไว้"
      );
    }

    if (/model|does not exist|not found|unsupported/i.test(openAIMessage)) {
      throw new GenerateError(
        `OpenAI model unavailable: ${openAIMessage || openAICode}`,
        status,
        `โมเดล ${model} ใช้งานไม่ได้กับบัญชีนี้ หรือยังไม่มีสิทธิ์เข้าถึง กรุณาลองเลือก GPT Image 1.5 หรือ GPT Image 2 แล้วลองใหม่`
      );
    }

    if (response.status === 401) {
      throw new GenerateError(
        `OpenAI authentication failed: ${openAIMessage || openAICode}`,
        401,
        "OPENAI_API_KEY ใช้งานไม่ได้หรือหมดอายุ กรุณาสร้าง API key ใหม่แล้วใส่ใน Environment Variables ของ Vercel"
      );
    }

    throw new GenerateError(
      `OpenAI image request failed (${response.status}): ${
        openAIMessage || openAICode || response.statusText
      }`,
      status,
      `OpenAI generate ไม่สำเร็จ (${response.status}): ${
        openAIMessage || openAICode || response.statusText
      }`
    );
  }

  const imageBase64 = data?.data?.[0]?.b64_json;

  if (!imageBase64) {
    return null;
  }

  return {
    mimeType: "image/png",
    data: imageBase64,
  };
}

async function generateImage({
  model,
  prompt,
  images,
  aspectRatio,
  quality,
}: {
  model: ImageModel;
  prompt: string;
  images: File[];
  aspectRatio: string;
  quality: ImageQuality;
}) {
  if (isOpenAIModel(model)) {
    return generateWithOpenAI({
      model,
      prompt,
      images,
      aspectRatio,
      quality,
    });
  }

  return generateWithGemini({ prompt, images, aspectRatio });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (typeof error === "string") return error;

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return "Unknown error";
}

function getClientErrorMessage(error: unknown, requestId: string) {
  const message = getErrorMessage(error);

  if (error instanceof GenerateError && error.clientMessage) {
    return error.clientMessage;
  }

  if (message === "Missing OPENAI_API_KEY") {
    return "ยังไม่ได้ตั้งค่า OPENAI_API_KEY สำหรับใช้งาน GPT Image";
  }

  if (message === "Invalid OPENAI_API_KEY") {
    return "ค่า OPENAI_API_KEY ไม่ถูกต้อง ต้องเป็น API key จริงที่ขึ้นต้นด้วย sk- ไม่ใช่ชื่อโมเดล";
  }

  if (message === "Missing GEMINI_API_KEY") {
    return "ยังไม่ได้ตั้งค่า GEMINI_API_KEY สำหรับใช้งาน Gemini";
  }

  if (message === "Missing DATABASE_URL") {
    return "ระบบฐานข้อมูลยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ";
  }

  if (message.startsWith("OpenAI")) {
    return `OpenAI generate ไม่สำเร็จ: ${message}`;
  }

  return `ระบบสร้างภาพขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง (รหัสคำขอ: ${requestId})`;
}

function quotaErrorMessage(reason: string | undefined, remainingImages: number) {
  if (reason === "quota_exceeded") {
    return `โควตารูปของแพ็กเกจนี้ไม่พอ เหลือ ${remainingImages} รูปในรอบเดือนนี้`;
  }

  if (reason === "too_many_images") {
    return "จำนวนรูปที่ขอสร้างต่อครั้งเกินสิทธิ์ของแพ็กเกจ";
  }

  if (reason === "expired_subscription") {
    return "แพ็กเกจหมดอายุแล้ว กรุณาต่ออายุเพื่อใช้งานต่อ";
  }

  return "ยังไม่มีแพ็กเกจที่ใช้งานได้ กรุณาสมัครหรือต่ออายุแพ็กเกจก่อน";
}

async function getSubscriptionAccessForRequest(req: NextRequest) {
  if (!canUseDatabaseBackedSubscriptions()) {
    return null;
  }

  const user = await getCurrentUser(req);
  if (!user) {
    throw new GenerateError(
      "Missing authenticated user",
      401,
      "กรุณาเข้าสู่ระบบก่อนใช้งาน"
    );
  }

  if (
    user.role === "admin" ||
    isConfiguredAdminIdentity({
      email: user.email,
    })
  ) {
    return createAdminSubscriptionAccess(user.id);
  }

  const access = await getActiveSubscriptionAccessByUserId(user.id);
  if (!access) {
    throw new GenerateError(
      `No active subscription for user ${user.id}`,
      403,
      "ยังไม่มีแพ็กเกจที่ใช้งานได้ กรุณาสมัครหรือต่ออายุแพ็กเกจก่อน"
    );
  }

  return access;
}

function assertCanGenerateImages({
  access,
  requestedImages,
}: {
  access: ActiveSubscriptionAccess | null;
  requestedImages: number;
}) {
  if (!access) return;

  const quota = checkImageQuota({
    plan: access.plan,
    subscriptionStatus: access.status,
    usedImagesThisPeriod: access.usedImagesThisPeriod,
    requestedImages,
    currentPeriodEnd: access.currentPeriodEnd,
  });

  if (!quota.allowed) {
    throw new GenerateError(
      `Subscription quota check failed: ${quota.reason}`,
      403,
      quotaErrorMessage(quota.reason, quota.remainingImages)
    );
  }
}

function getSpecialFeatureForRequest({
  formData,
  access,
}: {
  formData: FormData;
  access: ActiveSubscriptionAccess | null;
}): SpecialFeaturePrompt | undefined {
  const enabled = String(formData.get("specialFeatureEnabled") || "") === "true";

  if (!enabled) return undefined;

  if (access && !access.plan.hasSpecialFeatures) {
    throw new GenerateError(
      `Special feature denied for plan ${access.plan.slug}`,
      403,
      "ฟีเจอร์พิเศษนี้สำหรับแพ็กเกจ 499/999 เท่านั้น กรุณาอัปเกรดแพ็กเกจก่อนใช้งาน"
    );
  }

  const note = String(formData.get("specialFeatureNote") || "")
    .trim()
    .slice(0, 500);

  return {
    enabled: true,
    styles: normalizeSpecialFeatureStyles(formData.getAll("specialFeatureStyle")),
    note,
  };
}

async function recordSuccessfulUsage({
  access,
  action,
  imageCount,
  model,
}: {
  access: ActiveSubscriptionAccess | null;
  action: "generate" | "refine";
  imageCount: number;
  model: string;
}) {
  if (!access || imageCount <= 0) return;

  await recordUsageEvent({
    userId: access.userId,
    subscriptionId: access.subscriptionId,
    planSlug: access.plan.slug,
    action,
    imageCount,
    model,
  });
}

async function recordUsageSafely({
  access,
  action,
  imageCount,
  model,
  requestId,
}: {
  access: ActiveSubscriptionAccess | null;
  action: "generate" | "refine";
  imageCount: number;
  model: string;
  requestId: string;
}) {
  try {
    await recordSuccessfulUsage({ access, action, imageCount, model });
    return null;
  } catch (error) {
    console.error("Failed to record generation usage", {
      requestId,
      action,
      imageCount,
      model,
      error: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return `สร้างภาพสำเร็จแล้ว แต่บันทึกโควตายังไม่เสร็จ (รหัสคำขอ: ${requestId})`;
  }
}

async function recordHistorySafely({
  access,
  action,
  model,
  imageQuality,
  aspectRatio,
  requestedImageCount,
  images,
}: {
  access: ActiveSubscriptionAccess | null;
  action: "generate" | "refine";
  model: string;
  imageQuality: string;
  aspectRatio: string;
  requestedImageCount: number;
  images: string[];
}) {
  try {
    await recordGenerationHistory({
      access,
      action,
      model,
      imageQuality,
      aspectRatio,
      requestedImageCount,
      images,
    });
  } catch (error) {
    console.error("Failed to record generation history:", error);
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  let phase = "request";

  try {
    const formData = await req.formData();
    phase = "subscription-check";
    const subscriptionAccess = await getSubscriptionAccessForRequest(req);
    const mode = String(formData.get("mode") || "generate");
    const selectedModel = normalizeImageModel(
      String(formData.get("aiModel") || process.env.IMAGE_MODEL || "")
    );
    const imageQuality = normalizeImageQuality(
      String(formData.get("imageQuality") || process.env.IMAGE_QUALITY || "")
    );
    phase = "configuration";
    const specialFeature = getSpecialFeatureForRequest({
      formData,
      access: subscriptionAccess,
    });
    let usedGeminiFallback = false;

    async function generateImageForRequest({
      model,
      prompt,
      images,
      aspectRatio,
      quality,
    }: {
      model: ImageModel;
      prompt: string;
      images: File[];
      aspectRatio: string;
      quality: ImageQuality;
    }) {
      try {
        return await generateImage({
          model,
          prompt,
          images,
          aspectRatio,
          quality,
        });
      } catch (error) {
        if (isOpenAIModel(model) && isSafetyError(error)) {
          try {
            const imageData = await generateImage({
              model: GEMINI_MODEL,
              prompt,
              images,
              aspectRatio,
              quality,
            });

            usedGeminiFallback = true;
            return imageData;
          } catch (fallbackError) {
            if (
              fallbackError instanceof Error &&
              fallbackError.message === "Missing GEMINI_API_KEY"
            ) {
              throw new GenerateError(
                `OpenAI safety rejected request and Gemini fallback is not configured: ${
                  error instanceof Error ? error.message : "unknown error"
                }`,
                400,
                "OpenAI ปฏิเสธภาพนี้ด้วย safety system และยังไม่ได้ตั้งค่า GEMINI_API_KEY สำหรับ fallback กรุณาเลือกโมเดล Gemini หลังตั้งค่า key หรือเปลี่ยนภาพอ้างอิงให้ปลอดภัยขึ้น"
              );
            }

            throw fallbackError;
          }
        }

        throw error;
      }
    }

    // =========================
    // REFINE MODE
    // =========================
    if (mode === "refine") {
      const generatedImage = formData.get("generatedImage") as File | null;
      const editInstruction = String(
        formData.get("editInstruction") || ""
      ).trim();

      if (!generatedImage) {
        return NextResponse.json(
          { error: "ไม่พบภาพผลลัพธ์เดิมสำหรับแก้ไข" },
          { status: 400 }
        );
      }

      if (!editInstruction) {
        return NextResponse.json(
          { error: "กรุณาระบุคำสั่งที่ต้องการแก้ไขภาพ" },
          { status: 400 }
        );
      }

      const aspectRatio = normalizeAspectRatio(
        String(formData.get("aspectRatio") || "1:1")
      );
      assertCanGenerateImages({
        access: subscriptionAccess,
        requestedImages: 1,
      });

      phase = "ai-generation";
      const imageData = await generateImageForRequest({
        model: selectedModel,
        prompt: buildRefinePrompt({
          editInstruction,
          targetShop: String(formData.get("targetShop") || ""),
          aspectRatio: promptAspectRatioFromSelection(aspectRatio),
          specialFeature,
        }),
        images: [generatedImage],
        aspectRatio,
        quality: imageQuality,
      });

      if (!imageData) {
        return NextResponse.json(
          { error: "AI ไม่ได้ส่งภาพที่แก้ไขกลับมา" },
          { status: 500 }
        );
      }

      const resultImage = `data:${imageData.mimeType};base64,${imageData.data}`;

      const usageWarning = await recordUsageSafely({
        access: subscriptionAccess,
        action: "refine",
        imageCount: 1,
        model: selectedModel,
        requestId,
      });

      await recordHistorySafely({
        access: subscriptionAccess,
        action: "refine",
        model: selectedModel,
        imageQuality,
        aspectRatio,
        requestedImageCount: 1,
        images: [resultImage],
      });

      return NextResponse.json({
        image: resultImage,
        warning:
          usageWarning ||
          (usedGeminiFallback
            ? "OpenAI ปฏิเสธด้วย safety system ระบบจึงใช้ Gemini fallback แทน"
            : undefined),
      });
    }

    // =========================
    // GENERATE MODE
    // =========================
    const image1 = formData.get("image1") as File | null;
    const image2 = formData.get("image2") as File | null;
    const image3 = formData.get("image3") as File | null;

    if (!(image1 instanceof File) || !(image2 instanceof File) || !(image3 instanceof File)) {
      return NextResponse.json(
        { error: "กรุณาอัปโหลดภาพให้ครบ 3 ภาพ" },
        { status: 400 }
      );
    }

    const targetShop = String(formData.get("targetShop") || "").trim();
    const aspectRatio = normalizeAspectRatio(
      String(formData.get("aspectRatio") || "1:1")
    );
    const outputCount = normalizeOutputCount(
      String(formData.get("outputCount") || "1")
    );
    assertCanGenerateImages({
      access: subscriptionAccess,
      requestedImages: outputCount,
    });

    const prompt = buildPrompt({
      targetShop,
      aspectRatio: promptAspectRatioFromSelection(aspectRatio),
      specialFeature,
    });

    const images: string[] = [];
    let firstGenerateError: unknown = null;

    phase = "ai-generation";
    for (let index = 0; index < outputCount; index += 1) {
      try {
        const imageData = await generateImageForRequest({
          model: selectedModel,
          prompt,
          images: [image1, image2, image3],
          aspectRatio,
          quality: imageQuality,
        });

        if (imageData) {
          images.push(`data:${imageData.mimeType};base64,${imageData.data}`);
        }
      } catch (error) {
        firstGenerateError ||= error;

        if (images.length === 0) {
          throw error;
        }

        break;
      }
    }

    if (images.length === 0) {
      if (firstGenerateError) {
        throw firstGenerateError;
      }

      return NextResponse.json(
        { error: "AI ไม่ได้ส่งภาพกลับมา" },
        { status: 500 }
      );
    }

    const usageWarning = await recordUsageSafely({
      access: subscriptionAccess,
      action: "generate",
      imageCount: countSuccessfulGeneratedImages(images),
      model: selectedModel,
      requestId,
    });

    await recordHistorySafely({
      access: subscriptionAccess,
      action: "generate",
      model: selectedModel,
      imageQuality,
      aspectRatio,
      requestedImageCount: outputCount,
      images,
    });

    return NextResponse.json({
      image: images[0],
      images,
      warning:
        usageWarning ||
        (usedGeminiFallback
          ? "OpenAI ปฏิเสธด้วย safety system ระบบจึงใช้ Gemini fallback แทน"
          : images.length < outputCount
          ? `สร้างได้ ${images.length} จาก ${outputCount} ภาพ เพราะบาง request ไม่สำเร็จ`
          : undefined),
    });
  } catch (error) {
    console.error("route.ts error", {
      requestId,
      phase,
      error: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    const status = error instanceof GenerateError ? error.status : 500;

    return NextResponse.json(
      {
        error: getClientErrorMessage(error, requestId),
        requestId,
      },
      { status }
    );
  }
}
