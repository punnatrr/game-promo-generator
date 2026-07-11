export const ASPECT_RATIOS = [
  "1:1",
  "3:4",
  "4:5",
  "9:16",
  "4:3",
  "16:9",
] as const;

export const IMAGE_QUALITIES = ["low", "medium", "high"] as const;
export const OPENAI_IMAGE_MODELS = ["gpt-image-1.5", "gpt-image-2"] as const;
export const GEMINI_MODEL = "gemini-3-pro-image-preview" as const;
export const IMAGE_MODELS = [...OPENAI_IMAGE_MODELS, GEMINI_MODEL] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];
export type OpenAIImageModel = (typeof OPENAI_IMAGE_MODELS)[number];
export type GeminiImageModel = typeof GEMINI_MODEL;
export type ImageModel = (typeof IMAGE_MODELS)[number];

export type ImageResult = {
  mimeType: string;
  data: string;
};

export const DEFAULT_IMAGE_MODEL: ImageModel = "gpt-image-1.5";
export const DEFAULT_IMAGE_QUALITY: ImageQuality = "medium";

function isOneOf<const T extends readonly string[]>(
  values: T,
  value: string
): value is T[number] {
  return values.some((candidate) => candidate === value);
}

export function normalizeAspectRatio(value: string): AspectRatio {
  return isOneOf(ASPECT_RATIOS, value) ? value : "1:1";
}

export function normalizeImageModel(value: string): ImageModel {
  return isOneOf(IMAGE_MODELS, value) ? value : DEFAULT_IMAGE_MODEL;
}

export function normalizeImageQuality(value: string): ImageQuality {
  return isOneOf(IMAGE_QUALITIES, value) ? value : DEFAULT_IMAGE_QUALITY;
}

export function isOpenAIModel(
  model: ImageModel
): model is OpenAIImageModel {
  return isOneOf(OPENAI_IMAGE_MODELS, model);
}

export function promptAspectRatio(aspectRatio: AspectRatio): string {
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

  return prompts[aspectRatio];
}

export function providerAspectRatio(
  aspectRatio: AspectRatio
): AspectRatio | "3:4" {
  return aspectRatio === "4:5" ? "3:4" : aspectRatio;
}

export function openAIImageSize(aspectRatio: AspectRatio): string {
  return aspectRatio === "1:1" ? "1024x1024" : "auto";
}
