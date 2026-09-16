import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseUrl } from "@/lib/db";
import {
  MAX_PAYMENT_PROOF_BYTES,
  PaymentProofValidationError,
  deletePaymentProofBlob,
  uploadPaymentProof,
} from "@/lib/payments/proof-storage";
import { assertUserOwnsPayment, savePaymentProof } from "@/lib/payments/repository";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let uploadedUrl: string | null = null;

  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า DATABASE_URL" }, { status: 503 });
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อนส่งหลักฐานการชำระเงิน" },
        { status: 401 }
      );
    }

    const form = await req.formData();
    const paymentId = String(form.get("paymentId") || "").trim();
    const note = String(form.get("note") || "").trim().slice(0, 1000);
    const proofFile = form.get("proof");

    if (!paymentId || !(proofFile instanceof File)) {
      return NextResponse.json(
        { error: "กรุณาระบุรายการชำระเงินและเลือกไฟล์หลักฐาน" },
        { status: 400 }
      );
    }
    if (proofFile.size > MAX_PAYMENT_PROOF_BYTES) {
      return NextResponse.json(
        { error: "ไฟล์หลักฐานต้องมีขนาดไม่เกิน 4 MB" },
        { status: 413 }
      );
    }

    const payment = await assertUserOwnsPayment({ userId: user.id, paymentId });
    if (!payment) {
      return NextResponse.json({ error: "ไม่พบรายการชำระเงินนี้" }, { status: 404 });
    }
    if (payment.status !== "pending") {
      return NextResponse.json(
        { error: "รายการนี้หมดอายุหรือไม่ได้อยู่ในสถานะรอชำระเงิน" },
        { status: 409 }
      );
    }

    const uploaded = await uploadPaymentProof({ paymentId, file: proofFile });
    uploadedUrl = uploaded.url;

    const result = await savePaymentProof({
      userId: user.id,
      paymentId,
      proofImageUrl: uploaded.url,
      blobPathname: uploaded.pathname,
      contentType: uploaded.contentType,
      sizeBytes: uploaded.sizeBytes,
      originalFilename: uploaded.originalFilename,
      note,
    });

    if (result.outcome !== "saved") {
      await deletePaymentProofBlob(uploaded.url).catch(console.error);
      uploadedUrl = null;
      return NextResponse.json(
        {
          error:
            result.outcome === "not_found"
              ? "ไม่พบรายการชำระเงินนี้"
              : "รายการนี้หมดอายุหรือไม่ได้อยู่ในสถานะรอชำระเงิน",
        },
        { status: result.outcome === "not_found" ? 404 : 409 }
      );
    }

    uploadedUrl = null;
    if (result.previousProofImageUrl && result.previousProofImageUrl !== uploaded.url) {
      await deletePaymentProofBlob(result.previousProofImageUrl).catch((error) => {
        console.error("delete replaced payment proof error:", error);
      });
    }

    return NextResponse.json({
      proof: { id: result.proofId },
      message: "ส่งหลักฐานแล้ว รอผู้ดูแลตรวจสอบ",
    });
  } catch (error) {
    if (uploadedUrl) await deletePaymentProofBlob(uploadedUrl).catch(console.error);
    if (error instanceof PaymentProofValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("payment proof error:", error);
    return NextResponse.json(
      { error: "อัปโหลดหลักฐานไม่สำเร็จ กรุณาตรวจการตั้งค่า Private Blob" },
      { status: 500 }
    );
  }
}
