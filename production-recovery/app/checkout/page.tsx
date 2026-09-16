"use client";

import { useEffect, useMemo, useState } from "react";
import type { SubscriptionPlan } from "@/lib/subscription/plans";

type PaymentMethod = "promptpay" | "bank_transfer";

type PaymentResponse = {
  payment: {
    id: string;
    planName: string;
    amountThb: number;
    method: PaymentMethod;
    status: string;
  };
  instructions: {
    promptPayId: string;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
  };
};

export default function CheckoutPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState(() => {
    if (typeof window === "undefined") return "basic";

    return new URLSearchParams(window.location.search).get("plan") || "basic";
  });
  const [method, setMethod] = useState<PaymentMethod>("promptpay");
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadPlans() {
      const res = await fetch("/api/plans");
      const data = await res.json();
      setPlans(data.plans || []);
    }

    loadPlans();
  }, []);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.slug === selectedPlanSlug) || plans[0],
    [plans, selectedPlanSlug]
  );

  async function createPayment() {
    if (!selectedPlan) return;

    setLoading(true);
    setMessage("");
    setPayment(null);

    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planSlug: selectedPlan.slug,
          method,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "สร้างรายการชำระเงินไม่สำเร็จ");
        return;
      }

      setPayment(data);
    } catch (error) {
      console.error(error);
      setMessage("สร้างรายการชำระเงินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function submitProof() {
    if (!payment) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/payments/proof", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentId: payment.payment.id,
          proofImageUrl,
          note: proofNote,
        }),
      });
      const data = await res.json();

      setMessage(data.message || data.error || "ส่งหลักฐานแล้ว");
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
          <p className="mb-3 text-sm font-medium text-purple-300">
            LAZY-AI.GAME Payment
          </p>
          <h1 className="text-4xl font-black tracking-tight">
            ชำระเงินแพ็กเกจ
          </h1>
          <p className="mt-3 max-w-2xl text-white/50">
            Phase นี้เป็นการสร้างรายการชำระเงินแบบ manual สำหรับ PromptPay
            และโอนเงิน การอนุมัติและเปิดสิทธิ์จะอยู่ใน Phase ถัดไป
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">เลือกรายการ</h2>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-white/60">แพ็กเกจ</span>
              <select
                value={selectedPlanSlug}
                onChange={(e) => setSelectedPlanSlug(e.target.value)}
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
                {(["promptpay", "bank_transfer"] as PaymentMethod[]).map(
                  (value) => (
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
                  )
                )}
              </div>
            </div>

            {selectedPlan && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/65">
                <p className="font-bold text-white">{selectedPlan.name}</p>
                <p className="mt-1">{selectedPlan.description}</p>
                <p className="mt-3 text-2xl font-black text-purple-300">
                  ฿{selectedPlan.priceMonthlyThb}
                </p>
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
                  <p className="mt-1 text-4xl font-black">
                    ฿{payment.payment.amountThb}
                  </p>
                  <p className="mt-2 text-sm text-white/50">
                    รหัสรายการ: {payment.payment.id}
                  </p>
                </div>

                {payment.payment.method === "promptpay" ? (
                  <PaymentLine
                    label="PromptPay"
                    value={payment.instructions.promptPayId || "ยังไม่ได้ตั้งค่า PROMPTPAY_ID"}
                  />
                ) : (
                  <>
                    <PaymentLine
                      label="ธนาคาร"
                      value={payment.instructions.bankName || "ยังไม่ได้ตั้งค่า BANK_NAME"}
                    />
                    <PaymentLine
                      label="ชื่อบัญชี"
                      value={
                        payment.instructions.bankAccountName ||
                        "ยังไม่ได้ตั้งค่า BANK_ACCOUNT_NAME"
                      }
                    />
                    <PaymentLine
                      label="เลขบัญชี"
                      value={
                        payment.instructions.bankAccountNumber ||
                        "ยังไม่ได้ตั้งค่า BANK_ACCOUNT_NUMBER"
                      }
                    />
                  </>
                )}

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <h3 className="font-bold">ส่งหลักฐานการชำระเงิน</h3>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm text-white/50">
                      ลิงก์รูปสลิปหรือหลักฐาน
                    </span>
                    <input
                      value={proofImageUrl}
                      onChange={(e) => setProofImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-white/40"
                    />
                  </label>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm text-white/50">
                      หมายเหตุ
                    </span>
                    <textarea
                      value={proofNote}
                      onChange={(e) => setProofNote(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-white/40"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={submitProof}
                    disabled={loading || !proofImageUrl.trim()}
                    className="mt-4 w-full rounded-2xl bg-emerald-400 px-5 py-4 font-bold text-black transition hover:bg-emerald-300 disabled:opacity-60"
                  >
                    ส่งหลักฐาน
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
