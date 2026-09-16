export type ManualPaymentMethod = "promptpay" | "bank_transfer";

export function getManualPaymentConfig() {
  return {
    promptPayId: process.env.PROMPTPAY_ID || "",
    bankName: process.env.BANK_NAME || "",
    bankAccountName: process.env.BANK_ACCOUNT_NAME || "",
    bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER || "",
  };
}

export function isManualPaymentMethod(
  method: string
): method is ManualPaymentMethod {
  return method === "promptpay" || method === "bank_transfer";
}
