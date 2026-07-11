export class GenerateError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly clientMessage?: string
  ) {
    super(message);
    this.name = "GenerateError";
  }
}

export function getClientErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "เกิดข้อผิดพลาดในระบบ generate image";
  }

  if (error instanceof GenerateError && error.clientMessage) {
    return error.clientMessage;
  }

  const messages: Record<string, string> = {
    "Missing OPENAI_API_KEY":
      "ยังไม่ได้ตั้งค่า OPENAI_API_KEY สำหรับใช้งาน GPT Image",
    "Invalid OPENAI_API_KEY":
      "ค่า OPENAI_API_KEY ไม่ถูกต้อง ต้องเป็น API key จริงที่ขึ้นต้นด้วย sk- ไม่ใช่ชื่อโมเดล",
    "Missing GEMINI_API_KEY":
      "ยังไม่ได้ตั้งค่า GEMINI_API_KEY สำหรับใช้งาน Gemini",
  };

  return messages[error.message] ?? "เกิดข้อผิดพลาดในระบบ generate image";
}
