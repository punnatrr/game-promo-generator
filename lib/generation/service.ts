import {
  isOpenAIModel,
  type AspectRatio,
  type ImageModel,
  type ImageQuality,
  type ImageResult,
} from "@/lib/generation/config";
import { generateWithGemini } from "@/lib/generation/providers/gemini";
import { generateWithOpenAI } from "@/lib/generation/providers/openai";

export type GenerateImageInput = {
  model: ImageModel;
  prompt: string;
  images: File[];
  aspectRatio: AspectRatio;
  quality: ImageQuality;
};

export async function generateImage(
  input: GenerateImageInput
): Promise<ImageResult | null> {
  if (isOpenAIModel(input.model)) {
    return generateWithOpenAI({ ...input, model: input.model });
  }

  return generateWithGemini(input);
}
