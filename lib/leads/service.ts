import { readBrand } from "@/lib/brand/repository";
import { analyzeLeadWithAi, LEAD_AI_PROMPT_VERSION } from "./ai";
import { analyzeByRules, detectGame, normalizedTextHash, normalizeLeadText } from "./logic";
import {
  applyAiAnalysis,
  findPriceForLead,
  gameDictionary,
  getLeadForReply,
  insertLeadFromAnalysis,
  markAiFailed,
  saveLeadReply,
} from "./repository";

export async function ingestLead(args: {
  userId: string;
  text: string;
  sourceType?: string;
  sourceUrl?: string | null;
  sourceExternalId?: string | null;
  authorName?: string | null;
}) {
  const text = args.text.trim();
  if (!text || text.length > 12000) throw new Error("INVALID_LEAD_TEXT");

  const games = await gameDictionary();
  const detectedGame = detectGame(text, games);
  const rules = analyzeByRules(text, detectedGame?.confidence || 0);
  const normalizedText = normalizeLeadText(text);
  const textHash = normalizedTextHash(text);

  const stored = await insertLeadFromAnalysis({
    userId: args.userId,
    text,
    sourceType: args.sourceType || "MANUAL",
    sourceUrl: args.sourceUrl || null,
    sourceExternalId: args.sourceExternalId || null,
    authorName: args.authorName || null,
    normalizedText,
    textHash,
    gameId: detectedGame?.id || null,
    gameConfidence: detectedGame?.confidence || 0,
    rules,
  });

  if (stored.duplicate) return stored;

  try {
    const ai = await analyzeLeadWithAi(text, games.map((game) => game.slug));
    if (ai) {
      await applyAiAnalysis({
        userId: args.userId,
        leadId: stored.id,
        analysis: ai.analysis,
        model: ai.model,
        promptVersion: LEAD_AI_PROMPT_VERSION,
        sourceHash: textHash,
        latencyMs: ai.latencyMs,
      });
    } else {
      await markAiFailed(args.userId, stored.id, textHash, "AI_NOT_CONFIGURED");
    }
  } catch (error) {
    const code =
      error instanceof Error
        ? error.message.replace(/[^A-Z0-9_:-]/gi, "_").slice(0, 64)
        : "AI_FAILED";
    await markAiFailed(args.userId, stored.id, textHash, code);
  }

  return stored;
}

function compactPackage(lead: Record<string, unknown>) {
  const currency = typeof lead.detected_currency === "string" ? lead.detected_currency : "";
  const amount = lead.detected_amount === null || lead.detected_amount === undefined ? "" : String(lead.detected_amount);
  const named = typeof lead.detected_package === "string" ? lead.detected_package : "";
  return [amount, currency].filter(Boolean).join(" ") || named || "";
}

function fallbackReply(args: {
  storeName: string;
  gameName: string;
  packageText: string;
  price: number | null;
}) {
  const game = args.gameName || "เกมนี้";
  const packagePart = args.packageText ? ` ${args.packageText}` : "";
  if (args.price !== null) {
    return `รับเติม ${game}${packagePart} ครับ ราคา ${args.price} บาท เติมกับ ${args.storeName} ได้เลยครับ ⚡`;
  }
  return `มีรับเติม ${game}${packagePart} ครับ สามารถสอบถามราคาแพ็กล่าสุดกับ ${args.storeName} ได้เลยครับ ⚡`;
}

export async function generateLeadReply(args: {
  userId: string;
  leadId: string;
  tone?: string;
}) {
  const lead = await getLeadForReply(args.userId, args.leadId);
  if (!lead) throw new Error("LEAD_NOT_FOUND");

  const [price, brand] = await Promise.all([
    findPriceForLead(args.userId, args.leadId),
    readBrand(args.userId),
  ]);
  const storeName = brand.profile.shopName || "ร้านของเรา";
  const gameName = typeof lead.game_name === "string" ? lead.game_name : "เกมนี้";
  const packageText = compactPackage(lead as Record<string, unknown>);
  const priceValue =
    price && Number.isFinite(Number(price.price_thb)) ? Number(price.price_thb) : null;

  const content = fallbackReply({
    storeName,
    gameName,
    packageText,
    price: priceValue,
  });

  return saveLeadReply({
    userId: args.userId,
    leadId: args.leadId,
    content,
    tone: args.tone || "SHORT_FRIENDLY",
    model: "rules-safe-reply-v1",
    pricePackageId: price?.id || null,
  });
}
