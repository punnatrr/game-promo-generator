import { GoogleGenAI } from "@google/genai";
import {
  GEMINI_MODEL,
  providerAspectRatio,
  type AspectRatio,
  type ImageResult,
} from "@/lib/generation/config";

type GeminiImagePart = {
  inlineData?: { mimeType?: string; data?: string };
};

type GeminiImageResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiImagePart[] };
  }>;
};

let googleAI: GoogleGenAI | null = null;

function getGoogleAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  googleAI ??= new GoogleGenAI({ apiKey });
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
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imageData = parts.find((part) => part.inlineData?.data)?.inlineData;

  if (!imageData?.data) return null;

  return {
    mimeType: imageData.mimeType || "image/png",
    data: imageData.data,
  };
}

export async function generateWithGemini({
  prompt,
  images,
  aspectRatio,
}: {
  prompt: string;
  images: File[];
  aspectRatio: AspectRatio;
}): Promise<ImageResult | null> {
  const imageParts = await Promise.all(images.map(fileToPart));
  const response = await getGoogleAI().models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, ...imageParts],
      },
    ],
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: providerAspectRatio(aspectRatio) },
    },
  });

  return extractImageData(response);
}
