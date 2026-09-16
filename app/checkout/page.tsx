"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { SubscriptionPlan } from "@/lib/subscription/plans";

type PaymentMethod = "promptpay" | "bank_transfer";
type PaymentStatus = "pending" | "paid" | "rejected" | "refunded" | "expired";

type Payment = {
  id: string;
  planName: string;
  amountThb: number;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
  expiresAt: string;
  hasProof: boolean;
  proofStatus: "pending" | "approved" | "rejected" | null;
};

type PaymentResponse = {
  payment: Payment;
  instructions: {
    promptPayQrImageUrl: string;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    paymentPendingHours: number;
  };
};

const statusLabel: Record<PaymentStatus, string> = {
  pending: "รอตรวจสอบ",
  paid: "ชำระแล้ว",
  rejected: "ไม่ผ่าน",
  refunded: "คืนเงินแล้ว",
  expired: "หมดอายุ",
};

export default function CheckoutPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState(() =>
    typeof window === "undefined"
      ? "basic"
      : new URLSearchParams(window.location.search).get("plan") || "basic"
  );
  const [method, setMethod] = useState<PaymentMethod>("promptpay");
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofNote, setProofNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPayments() {
    const res = await fetch("/api/payments/me", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setPayments(data.payments || []);
  }

  useEffect(() => {
    async function loadPage() {
      const [plansRes, paymentsRes] = await Promise.all([
        fetch("/api/plans"),
        fetch("/api/payments/me", { cache: "no-store" }),
      ]);
      const plansData = await plansRes.json();
      setPlans(plansData.plans || []);
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData.payments || []);
      }
    }
    loadPage().catch((error) => {
      console.error(error);
      setMessage("โหลดข้อมูลชำระเงินไม่สำเร็จ");
    });
  }, []);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.slug === selectedPlanSlug) || plans[0],
    [plans, selectedPlanSlug]
  );

  async function createPayment() {
    if (!selectedPlan) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ planSlug: selectedPlan.slug, method }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "สร้างรายการชำระเงินไม่สำเร็จ");
        return;
      }

      setPayment(data);
      setProofFile(null);
      await loadPayments();
    } catch (error) {
      console.error(error);
      setMessage("สร้างรายการชำระเงินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function submitProof() {
    if (!payment || !proofFile) return;
    setLoading(true);
    setMessage("");

    try {
      const form = new FormData();
      form.set("paymentId", payment.payment.id);
      form.set("proof", proofFile);
      form.set("note", proofNote);

      const res = await fetch("/api/payments/proof", { method: "POST", body: form });
      const data = await res.json();
      setMessage(data.message || data.error || "ส่งหลักฐานแล้ว");
      if (res.ok) {
        setPayment((current) =>
          current
            ? {
                ...current,
                payment: { ...current.payment, hasProof: true, proofStatus: "pending" },
              }
            : current
        );
        setProofFile(null);
        await loadPayments();
      }
    } catch (error) {
      console.error(error);
      setMessage("ส่งหลักฐานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="mb-3 text-sm font-medium text-purple-300">LAZY-AI.GAME Payment</p>
          <h1 className="text-4xl font-black tracking-tight">ชำระเงินแพ็กเกจ</h1>
          <p className="mt-3 max-w-2xl text-white/50">
            สร้างรายการ สแกน PromptPay หรือโอนเงิน แล้วอัปโหลดสลิปเพื่อให้ผู้ดูแลตรวจสอบ
            รายการที่อนุมัติแล้วจะเปิดสิทธิ์ใช้งาน 30 วัน
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">เลือกรายการ</h2>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-white/60">แพ็กเกจ</span>
              <select
                value={selectedPlanSlug}
                onChange={(event) => setSelectedPlanSlug(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-white/40"
              >
                {plans.map((plan) => (
                  <option key={plan.slug} value={plan.slug}>
                    {plan.name} - {plan.priceMonthlyThb} บาท/เดือน
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5">
              <p className="mb-2 text-sm text-white/60">ช่องทางชำระเงิน</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["promptpay", "bank_transfer"] as PaymentMethod[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMethod(value)}
                    className={`rounded-2xl border px-4 py-3 font-bold transition ${
                      method === value
                        ? "border-purple-300 bg-purple-400 text-black"
                        : "border-white/10 bg-black/40 text-white/70"
                    }`}
                  >
                    {value === "promptpay" ? "PromptPay" : "โอนเงิน"}
                  </button>
                ))}
              </div>
            </div>

            {selectedPlan && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/65">
                <p className="font-bold text-white">{selectedPlan.name}</p>
                <p className="mt-1">{selectedPlan.description}</p>
                <p className="mt-3 text-2xl font-black text-purple-300">฿{selectedPlan.priceMonthlyThb}</p>
              </div>
            )}

            <button
              type="button"
              onClick={createPayment}
              disabled={loading || !selectedPlan}
              className="mt-5 w-full rounded-2xl bg-purple-400 px-5 py-4 font-bold text-black transition hover:bg-purple-300 disabled:opacity-60"
            >
              {loading ? "กำลังดำเนินการ..." : "สร้างรายการชำระเงิน"}
            </button>

            {message && (
              <div className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                {message}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">รายละเอียดการชำระเงิน</h2>
            {payment ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-sm text-white/45">ยอดชำระ</p>
                  <p className="mt-1 text-4xl font-black">฿{payment.payment.amountThb}</p>
                  <p className="mt-2 break-all text-sm text-white/50">รหัสรายการ: {payment.payment.id}</p>
                  <p className="mt-1 text-sm text-amber-200">
                    ชำระภายใน {new Date(payment.payment.expiresAt).toLocaleString("th-TH")}
                  </p>
                </div>

                {payment.payment.method === "promptpay" ? (
                  <div className="rounded-2xl border border-white/10 bg-white p-4 text-center text-black">
                    <Image
                      src={payment.instructions.promptPayQrImageUrl}
                      alt={`PromptPay QR สำหรับชำระ ${payment.payment.amountThb} บาท`}
                      width={885}
                      height={1200}
                      unoptimized
                      className="mx-auto h-auto w-full max-w-72"
                    />
                    <p className="mt-3 text-sm font-bold">
                      กรุณากรอกยอด ฿{payment.payment.amountThb} ในแอปธนาคาร
                    </p>
                    <p className="mt-1 text-xs text-black/60">
                      ตรวจสอบชื่อผู้รับ {payment.instructions.bankAccountName || "นาย วรวีร์ เลี่ยมทอง"} ก่อนยืนยัน
                    </p>
                  </div>
                ) : (
                  <>
                    <PaymentLine label="ธนาคาร" value={payment.instructions.bankName || "ยังไม่ได้ตั้งค่า BANK_NAME"} />
                    <PaymentLine label="ชื่อบัญชี" value={payment.instructions.bankAccountName || "ยังไม่ได้ตั้งค่า BANK_ACCOUNT_NAME"} />
                    <PaymentLine label="เลขบัญชี" value={payment.instructions.bankAccountNumber || "ยังไม่ได้ตั้งค่า BANK_ACCOUNT_NUMBER"} />
                  </>
                )}

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <h3 className="font-bold">อัปโหลดหลักฐานการชำระเงิน</h3>
                  <p className="mt-1 text-xs text-white/45">JPG, PNG หรือ WebP ขนาดไม่เกิน 4 MB</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                    className="mt-4 block w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
                  />
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm text-white/50">หมายเหตุ (ถ้ามี)</span>
                    <textarea
                      value={proofNote}
                      onChange={(event) => setProofNote(event.target.value)}
                      rows={3}
                      maxLength={1000}
                      className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-white/40"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={submitProof}
                    disabled={loading || !proofFile || payment.payment.status !== "pending"}
                    className="mt-4 w-full rounded-2xl bg-emerald-400 px-5 py-4 font-bold text-black transition hover:bg-emerald-300 disabled:opacity-60"
                  >
                    {payment.payment.hasProof ? "อัปโหลดสลิปใหม่" : "ส่งหลักฐาน"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">
                สร้างรายการชำระเงินก่อน แล้วรายละเอียดจะปรากฏที่นี่
              </div>
            )}
          </section>
        </div>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-bold">ประวัติการชำระเงิน</h2>
          {payments.length === 0 ? (
            <p className="mt-4 text-sm text-white/40">ยังไม่มีรายการชำระเงิน</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {payments.map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold">{item.planName} · ฿{item.amountThb}</p>
                      <p className="mt-1 text-xs text-white/45">
                        {new Date(item.createdAt).toLocaleString("th-TH")} · {item.method}
                      </p>
                      {item.status === "pending" && (
                        <p className="mt-1 text-xs text-amber-200">
                          หมดอายุ {new Date(item.expiresAt).toLocaleString("th-TH")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.hasProof && (
                        <a
                          href={`/api/payments/proof/${item.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-emerald-300/30 px-3 py-1 text-xs font-bold text-emerald-200"
                        >
                          ดูสลิป
                        </a>
                      )}
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                        {statusLabel[item.status]}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function PaymentLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-sm text-white/45">{label}</p>
      <p className="mt-1 break-all text-lg font-bold">{value}</p>
    </div>
  );
}
