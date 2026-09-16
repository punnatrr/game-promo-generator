export type ManualPaymentMethod = "promptpay" | "bank_transfer";

export function getPaymentPendingHours() {
  const parsed = Number.parseInt(process.env.PAYMENT_PENDING_HOURS || "24", 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 168 ? parsed : 24;
}

export function getManualPaymentConfig() {
  return {
    promptPayQrImageUrl: "/payment/promptpay-qr.png",
    bankName: process.env.BANK_NAME || "",
    bankAccountName: process.env.BANK_ACCOUNT_NAME || "",
    bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER || "",
    paymentPendingHours: getPaymentPendingHours(),
  };
}

export function isManualPaymentMethod(
  method: string
): method is ManualPaymentMethod {
  return method === "promptpay" || method === "bank_transfer";
}
