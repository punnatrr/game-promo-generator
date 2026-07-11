import {
  openAIImageSize,
  type AspectRatio,
  type ImageQuality,
  type ImageResult,
  type OpenAIImageModel,
} from "@/lib/generation/config";
import { GenerateError } from "@/lib/generation/errors";

type OpenAIErrorResponse = {
  error?: { message?: unknown; code?: unknown };
};

type OpenAIImageResponse = OpenAIErrorResponse & {
  data?: Array<{ b64_json?: unknown }>;
};

function getOpenAIKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  if (!apiKey.startsWith("sk-")) throw new Error("Invalid OPENAI_API_KEY");

  return apiKey;
}

function throwOpenAIError(response: Response, data: OpenAIErrorResponse): never {
  const message =
    typeof data.error?.message === "string" ? data.error.message : "";
  const code = data.error?.code === undefined ? "" : String(data.error.code);
  const detail = message || code || response.statusText;

  if (response.status === 429 || /quota|rate limit|billing|spending/i.test(message)) {
    throw new GenerateError(
      `OpenAI quota/rate limit reached: ${detail}`,
      429,
      "โควตา/เครดิต OpenAI ไม่พอ หรือชน spending limit แล้ว กรุณาเติมเครดิตหรือเพิ่ม usage limit ใน OpenAI Platform แล้วลองใหม่"
    );
  }

  if (response.status === 401) {
    throw new GenerateError(
      `OpenAI authentication failed: ${detail}`,
      401,
      "OPENAI_API_KEY ใช้งานไม่ได้หรือหมดอายุ กรุณาสร้าง API key ใหม่แล้วใส่ใน Environment Variables ของ Vercel"
    );
  }

  throw new GenerateError(
    `OpenAI image request failed (${response.status}): ${detail}`,
    response.status >= 400 ? response.status : 500,
    "OpenAI generate ไม่สำเร็จ กรุณาตรวจสอบโมเดล/เครดิต แล้วลองใหม่อีกครั้ง"
  );
}

export async function generateWithOpenAI({
  model,
  prompt,
  images,
  aspectRatio,
  quality,
}: {
  model: OpenAIImageModel;
  prompt: string;
  images: File[];
  aspectRatio: AspectRatio;
  quality: ImageQuality;
}): Promise<ImageResult | null> {
  const body = new FormData();
  body.append("model", model);
  body.append("prompt", prompt);
  body.append("quality", quality);
  body.append("size", openAIImageSize(aspectRatio));
  body.append("output_format", "png");

  const imageFieldName = images.length > 1 ? "image[]" : "image";
  for (const image of images) {
    body.append(imageFieldName, image, image.name || "reference.png");
  }

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${getOpenAIKey()}` },
    body,
  });
  const payload: unknown = await response.json().catch(() => ({}));
  const data = (
    payload !== null && typeof payload === "object" ? payload : {}
  ) as OpenAIImageResponse;

  if (!response.ok) throwOpenAIError(response, data);

  const imageBase64 = data.data?.[0]?.b64_json;
  return typeof imageBase64 === "string"
    ? { mimeType: "image/png", data: imageBase64 }
    : null;
}
