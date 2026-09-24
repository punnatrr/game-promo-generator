export const LEAD_STATUSES = ["NEW","REVIEWED","CONTACTED","WAITING","FOLLOW_UP","WON","LOST","IGNORED"] as const;
export type LeadStatus = typeof LEAD_STATUSES[number];

export const LEAD_INTENTS = ["BUY_TOPUP","ASK_PRICE","LOOKING_FOR_STORE","ASK_PACKAGE","COMPARE_PRICE","ASK_AVAILABILITY","ASK_PAYMENT","ASK_PROMOTION","OTHER"] as const;
export type LeadIntent = typeof LEAD_INTENTS[number];

export type LeadTemperature = "HOT" | "WARM" | "POSSIBLE" | "LOW";
export type AnalysisStatus = "AI_PENDING" | "AI_SUCCEEDED" | "AI_FAILED" | "RULES_ONLY" | "NEEDS_REVIEW";

export type DetectedGame = {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  confidence: number;
  matchedAlias: string | null;
};

export type ExtractedProduct = {
  currency: string | null;
  amount: number | null;
  package: string | null;
};

export type RuleAnalysis = {
  intent: LeadIntent;
  intentConfidence: number;
  buyerConfidence: number;
  isSeller: boolean;
  isSpam: boolean;
  matchedKeywords: string[];
  product: ExtractedProduct;
  budget: number | null;
  location: string | null;
  platform: string | null;
  region: string | null;
  device: string | null;
  urgency: string | null;
  paymentMethod: string | null;
  language: string;
  leadScore: number;
  temperature: LeadTemperature;
  summary: string;
};

export type AiLeadAnalysis = {
  gameSlug: string | null;
  gameConfidence: number;
  intent: LeadIntent;
  intentConfidence: number;
  buyerConfidence: number;
  isSeller: boolean;
  isSpam: boolean;
  product: ExtractedProduct;
  budget: number | null;
  location: string | null;
  platform: string | null;
  region: string | null;
  device: string | null;
  urgency: string | null;
  paymentMethod: string | null;
  language: string;
  summary: string;
  suggestedTags: string[];
};
