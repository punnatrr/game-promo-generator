export const CONTACT_LABELS = {
  line: "LINE ID", facebook: "Facebook", website: "เว็บไซต์",
  discord: "Discord", tiktok: "TikTok", messenger: "Messenger",
} as const;
export const PAYMENT_METHODS = ["PromptPay", "โอนธนาคาร", "TrueMoney Wallet", "บัตรเครดิต/เดบิต"] as const;
export const TONES = ["เป็นกันเอง", "กระชับ ตรงประเด็น", "สนุก มีพลัง", "สุภาพ น่าเชื่อถือ"] as const;
export type BrandProfile = {
  shopName: string;
  logoId: string | null;
  primaryColor: string;
  secondaryColor: string;
  contacts: Record<keyof typeof CONTACT_LABELS, string>;
  paymentMethods: string[];
  defaultCta: string;
  tone: string;
  trustStatements: string[];
  claimsConfirmed: boolean;
};
export type BrandState = { profile: BrandProfile; version: number; updatedAt: string | null };
export const EMPTY_BRAND: BrandProfile = {
  shopName: "", logoId: null, primaryColor: "#a855f7", secondaryColor: "#ec4899",
  contacts: { line: "", facebook: "", website: "", discord: "", tiktok: "", messenger: "" },
  paymentMethods: [], defaultCta: "", tone: TONES[0], trustStatements: [], claimsConfirmed: false,
};
export class BrandValidationError extends Error {}
export class BrandConflictError extends Error {}
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BrandValidationError("รูปแบบข้อมูลไม่ถูกต้อง");
  return value as Record<string, unknown>;
}
function string(value: unknown, label: string, limit: number) {
  if (typeof value !== "string" || value.length > limit || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new BrandValidationError(`${label}ไม่ถูกต้อง หรือยาวเกิน ${limit} ตัวอักษร`);
  }
  return value.trim();
}
export function validateBrandSave(input: unknown): { profile: BrandProfile; version: number } {
  const body = record(input);
  if (!Number.isSafeInteger(body.version) || (body.version as number) < 0) throw new BrandValidationError("เวอร์ชันข้อมูลไม่ถูกต้อง");
  const raw = record(body.profile);
  const shopName = string(raw.shopName, "ชื่อร้าน", 100);
  if (!shopName) throw new BrandValidationError("กรุณากรอกชื่อร้าน");
  const primaryColor = string(raw.primaryColor, "สีหลัก", 7);
  const secondaryColor = string(raw.secondaryColor, "สีรอง", 7);
  if (![primaryColor, secondaryColor].every((c) => /^#[0-9a-f]{6}$/i.test(c))) throw new BrandValidationError("กรุณาระบุสีในรูปแบบ #RRGGBB");
  if (raw.logoId !== null && (typeof raw.logoId !== "string" || !UUID_PATTERN.test(raw.logoId))) throw new BrandValidationError("โลโก้ไม่ถูกต้อง");
  const rawContacts = record(raw.contacts);
  const contacts = { ...EMPTY_BRAND.contacts };
  for (const key of Object.keys(CONTACT_LABELS) as (keyof typeof CONTACT_LABELS)[]) {
    const value = string(rawContacts[key], CONTACT_LABELS[key], 500);
    if (value && key !== "line") {
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) throw new Error();
      } catch { throw new BrandValidationError(`${CONTACT_LABELS[key]}ต้องเป็นลิงก์ https:// ที่ถูกต้อง`); }
    }
    contacts[key] = value;
  }
  if (!Array.isArray(raw.paymentMethods) || raw.paymentMethods.length > PAYMENT_METHODS.length ||
      !raw.paymentMethods.every((m) => PAYMENT_METHODS.includes(m))) throw new BrandValidationError("ช่องทางชำระเงินไม่ถูกต้อง");
  if (!Array.isArray(raw.trustStatements) || raw.trustStatements.length > 5) throw new BrandValidationError("ระบุข้อความที่ร้านยืนยันได้ไม่เกิน 5 ข้อ");
  const trustStatements = [...new Set(raw.trustStatements.map((v) => string(v, "ข้อความที่ร้านยืนยัน", 120)).filter(Boolean))];
  if (typeof raw.claimsConfirmed !== "boolean" || (trustStatements.length > 0 && !raw.claimsConfirmed)) throw new BrandValidationError("กรุณายืนยันว่าข้อความเกี่ยวกับร้านเป็นข้อมูลจริง");
  if (!TONES.includes(raw.tone as typeof TONES[number])) throw new BrandValidationError("รูปแบบภาษาไม่ถูกต้อง");
  return { version: body.version as number, profile: {
    shopName, logoId: raw.logoId as string | null, primaryColor, secondaryColor, contacts,
    paymentMethods: [...new Set(raw.paymentMethods)] as string[],
    defaultCta: string(raw.defaultCta, "ข้อความชวนลูกค้า", 100), tone: raw.tone as string,
    trustStatements, claimsConfirmed: trustStatements.length > 0 && raw.claimsConfirmed,
  } };
}
