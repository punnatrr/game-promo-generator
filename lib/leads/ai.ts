import { GoogleGenAI } from "@google/genai";
import { LEAD_INTENTS, type AiLeadAnalysis, type LeadIntent } from "./types";

export const LEAD_AI_PROMPT_VERSION = "lead-radar-v1";
export const LEAD_AI_MODEL = process.env.LEAD_AI_MODEL || "gemini-2.5-flash";

function finite01(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}
function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function nullableNumber(value: unknown) {
  const n = Number(value);
  return value !== null && value !== "" && Number.isFinite(n) ? n : null;
}

export function validateAiLeadAnalysis(value: unknown): AiLeadAnalysis {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_AI_OBJECT");
  }
  const v = value as Record<string, unknown>;
  const intent = LEAD_INTENTS.includes(v.intent as LeadIntent)
    ? (v.intent as LeadIntent)
    : "OTHER";
  const p =
    v.product && typeof v.product === "object" && !Array.isArray(v.product)
      ? (v.product as Record<string, unknown>)
      : {};

  return {
    gameSlug: nullableString(v.gameSlug),
    gameConfidence: finite01(v.gameConfidence),
    intent,
    intentConfidence: finite01(v.intentConfidence),
    buyerConfidence: finite01(v.buyerConfidence),
    isSeller: v.isSeller === true,
    isSpam: v.isSpam === true,
    product: {
      currency: nullableString(p.currency)?.toUpperCase() || null,
      amount: nullableNumber(p.amount),
      package: nullableString(p.package),
    },
    budget: nullableNumber(v.budget),
    location: nullableString(v.location),
    platform: nullableString(v.platform),
    region: nullableString(v.region),
    device: nullableString(v.device),
    urgency: nullableString(v.urgency),
    paymentMethod: nullableString(v.paymentMethod),
    language: nullableString(v.language) || "th",
    summary: (nullableString(v.summary) || "ต้องตรวจสอบ Lead นี้เพิ่มเติม").slice(0, 300),
    suggestedTags: Array.isArray(v.suggestedTags)
      ? v.suggestedTags.filter((item): item is string => typeof item === "string").slice(0, 8)
      : [],
  };
}

export async function analyzeLeadWithAi(text: string, gameSlugs: string[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const started = Date.now();
  const response = await ai.models.generateContent({
    model: LEAD_AI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "วิเคราะห์ข้อความ Lead สำหรับร้านเติมเกมไทยเท่านั้น\n" +
              "เกมที่อนุญาตให้คืน gameSlug: " +
              gameSlugs.join(", ") +
              "\nห้ามเดาข้อมูลที่ไม่มีในข้อความ ถ้าไม่ทราบให้ null\n" +
              "แยกโพสต์ร้าน/ผู้ขายเป็น isSeller=true และสแปมเป็น isSpam=true\n" +
              "intent ต้องเป็นหนึ่งใน: " +
              LEAD_INTENTS.join(", ") +
              "\nตอบ JSON เท่านั้นตาม keys: gameSlug, gameConfidence, intent, intentConfidence, buyerConfidence, isSeller, isSpam, " +
              "product:{currency,amount,package}, budget, location, platform, region, device, urgency, paymentMethod, language, summary, suggestedTags\n\nข้อความ:\n" +
              text,
          },
        ],
      },
    ],
    config: { responseMimeType: "application/json", temperature: 0.1 },
  });

  const raw = response.text;
  if (!raw) throw new Error("EMPTY_AI_RESPONSE");
  const parsed = validateAiLeadAnalysis(JSON.parse(raw));
  return {
    analysis: parsed,
    latencyMs: Date.now() - started,
    model: LEAD_AI_MODEL,
  };
}
